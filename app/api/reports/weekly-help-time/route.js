import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_ZONE = "America/New_York";
const DEFAULT_RECIPIENT = "paytransparencyautomation@gmail.com";

function requireConfig(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function localDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type) => Number(parts.find((p) => p.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

function calendarDateFromParts({ year, month, day }) {
  // This Date is used only for calendar arithmetic, not as an actual timestamp.
  return new Date(Date.UTC(year, month - 1, day));
}

function addCalendarDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function dateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function easternDateKey(iso) {
  const parts = localDateParts(new Date(iso));
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function previousCompletedWeek(now = new Date()) {
  const today = calendarDateFromParts(localDateParts(now));
  const currentSunday = addCalendarDays(today, -today.getUTCDay());
  const previousSunday = addCalendarDays(currentSunday, -7);
  const previousSaturday = addCalendarDays(currentSunday, -1);

  return {
    startCalendar: previousSunday,
    endCalendar: previousSaturday,
    nextSundayCalendar: currentSunday,
    weekStart: dateKey(previousSunday),
    weekEnd: dateKey(previousSaturday),
  };
}

function formatReportDate(iso) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function formatReportTime(iso) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function formatSubjectDate(calendarDate) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(calendarDate);
}

function hoursBetween(start, stop) {
  return ((new Date(stop) - new Date(start)) / 36e5).toFixed(2);
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function buildCsv(entries) {
  const rows = [
    ["Employee", "Date", "Start", "Stop", "Hours"],
    ...entries.map((entry) => [
      entry.employees.display_name,
      formatReportDate(entry.clock_in),
      formatReportTime(entry.clock_in),
      formatReportTime(entry.clock_out),
      hoursBetween(entry.clock_in, entry.clock_out),
    ]),
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

async function sendWithResend({ csv, weekStart, weekEnd, startCalendar, endCalendar }) {
  const apiKey = requireConfig("RESEND_API_KEY");
  const from = requireConfig("WEEKLY_REPORT_FROM");
  const to = process.env.WEEKLY_REPORT_TO || DEFAULT_RECIPIENT;

  const subject =
    `Help Time Report — ${formatSubjectDate(startCalendar)}–${formatSubjectDate(endCalendar)}`;

  const filename = `help-time-${weekStart}-to-${weekEnd}.csv`;
  const attachment = Buffer.from(csv, "utf8").toString("base64");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `weekly-help-time/${weekStart}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html: `
        <p>Attached is the Help Time report for <strong>${weekStart}</strong> through
        <strong>${weekEnd}</strong>.</p>
        <p>The CSV columns are Employee, Date, Start, Stop, and Hours.</p>
      `,
      attachments: [
        {
          filename,
          content: attachment,
          content_type: "text/csv",
        },
      ],
    }),
  });

  const result = await response.json().catch(async () => ({
    raw: await response.text().catch(() => ""),
  }));

  if (!response.ok) {
    throw new Error(`Resend API error ${response.status}: ${JSON.stringify(result)}`);
  }

  return {
    id: result.id,
    recipient: to,
    subject,
    filename,
  };
}

export async function GET(request) {
  try {
    const cronSecret = requireConfig("CRON_SECRET");
    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const db = supabaseAdmin();
    const {
      startCalendar,
      endCalendar,
      nextSundayCalendar,
      weekStart,
      weekEnd,
    } = previousCompletedWeek();

    const { data: existing, error: existingError } = await db
      .from("weekly_report_runs")
      .select("status,resend_email_id,sent_at")
      .eq("week_start", weekStart)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Unable to check report history: ${existingError.message}`);
    }

    if (existing?.status === "sent") {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "This week's report has already been sent.",
        weekStart,
        weekEnd,
        resendEmailId: existing.resend_email_id,
        sentAt: existing.sent_at,
      });
    }

    // Query a deliberately wider UTC window, then filter by Eastern calendar date.
    // This avoids DST boundary mistakes while keeping the database query small.
    const coarseStart = addCalendarDays(startCalendar, -1).toISOString();
    const coarseEnd = addCalendarDays(nextSundayCalendar, 1).toISOString();

    const { data, error } = await db
      .from("help_time_entries")
      .select("id,clock_in,clock_out,employees!inner(display_name)")
      .not("clock_out", "is", null)
      .gte("clock_in", coarseStart)
      .lt("clock_in", coarseEnd)
      .order("clock_in", { ascending: true });

    if (error) {
      throw new Error(`Unable to load Help Time entries: ${error.message}`);
    }

    const entries = (data ?? [])
      .filter((entry) => {
        const key = easternDateKey(entry.clock_in);
        return key >= weekStart && key <= weekEnd;
      })
      .sort((a, b) => {
        const byEmployee = a.employees.display_name.localeCompare(
          b.employees.display_name
        );
        if (byEmployee !== 0) return byEmployee;
        return new Date(a.clock_in) - new Date(b.clock_in);
      });

    const recipient = process.env.WEEKLY_REPORT_TO || DEFAULT_RECIPIENT;

    const { error: pendingError } = await db
      .from("weekly_report_runs")
      .upsert(
        {
          week_start: weekStart,
          week_end: weekEnd,
          recipient,
          status: "pending",
          row_count: entries.length,
          error_message: null,
        },
        { onConflict: "week_start" }
      );

    if (pendingError) {
      throw new Error(`Unable to record pending report: ${pendingError.message}`);
    }

    const csv = buildCsv(entries);

    try {
      const sent = await sendWithResend({
        csv,
        weekStart,
        weekEnd,
        startCalendar,
        endCalendar,
      });

      const { error: sentError } = await db
        .from("weekly_report_runs")
        .update({
          status: "sent",
          row_count: entries.length,
          resend_email_id: sent.id,
          sent_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("week_start", weekStart);

      if (sentError) {
        console.error("Report sent, but audit update failed:", sentError);
      }

      return NextResponse.json({
        ok: true,
        weekStart,
        weekEnd,
        rows: entries.length,
        recipient: sent.recipient,
        filename: sent.filename,
        resendEmailId: sent.id,
      });
    } catch (sendError) {
      await db
        .from("weekly_report_runs")
        .update({
          status: "failed",
          error_message: String(sendError?.message || sendError).slice(0, 2000),
        })
        .eq("week_start", weekStart);

      throw sendError;
    }
  } catch (error) {
    console.error("Weekly Help Time report failed:", error);

    return NextResponse.json(
      {
        error: "Weekly Help Time report failed.",
        detail: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}
