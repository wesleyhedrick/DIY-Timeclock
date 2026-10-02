import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_ZONE = "America/New_York";

function requireSecret() {
  const secret =
    process.env.REPORT_EXPORT_SECRET ||
    process.env.CRON_SECRET;

  if (!secret) {
    throw new Error(
      "Missing REPORT_EXPORT_SECRET (or legacy CRON_SECRET) environment variable."
    );
  }

  return secret;
}

function localDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

function calendarDateFromParts({ year, month, day }) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addCalendarDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function dateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function easternDateKey(iso) {
  const parts = localDateParts(new Date(iso));
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day
  ).padStart(2, "0")}`;
}

function previousCompletedWeek(now = new Date()) {
  const today = calendarDateFromParts(localDateParts(now));
  const currentSunday = addCalendarDays(today, -today.getUTCDay());
  const previousSunday = addCalendarDays(currentSunday, -7);
  const previousSaturday = addCalendarDays(currentSunday, -1);

  return {
    startCalendar: previousSunday,
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

  return rows
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

function buildFilename(weekStart, weekEnd) {
  return `Help-Time-${weekStart}-to-${weekEnd}.csv`;
}

export async function GET(request) {
  try {
    const expectedSecret = requireSecret();
    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const db = supabaseAdmin();

    const {
      startCalendar,
      nextSundayCalendar,
      weekStart,
      weekEnd,
    } = previousCompletedWeek();

    const coarseStart = addCalendarDays(startCalendar, -1).toISOString();
    const coarseEnd = addCalendarDays(nextSundayCalendar, 1).toISOString();

    const { data, error } = await db
      .from("help_time_entries")
      .select(
        "id,clock_in,clock_out,employees!inner(display_name)"
      )
      .not("clock_out", "is", null)
      .gte("clock_in", coarseStart)
      .lt("clock_in", coarseEnd)
      .order("clock_in", { ascending: true });

    if (error) {
      throw new Error(
        `Unable to load Help Time entries: ${error.message}`
      );
    }

    const entries = (data ?? [])
      .filter((entry) => {
        const key = easternDateKey(entry.clock_in);
        return key >= weekStart && key <= weekEnd;
      })
      .sort((a, b) => {
        const employeeOrder =
          a.employees.display_name.localeCompare(
            b.employees.display_name
          );

        if (employeeOrder !== 0) {
          return employeeOrder;
        }

        return new Date(a.clock_in) - new Date(b.clock_in);
      });

    const csv = buildCsv(entries);
    const filename = buildFilename(weekStart, weekEnd);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Report-Filename": filename,
        "X-Report-Week-Start": weekStart,
        "X-Report-Week-End": weekEnd,
        "X-Report-Row-Count": String(entries.length),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Weekly Help Time CSV export failed:", error);

    return NextResponse.json(
      {
        error: "Weekly Help Time CSV export failed.",
        detail: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}
