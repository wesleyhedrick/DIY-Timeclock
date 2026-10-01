# Weekly Help Time CSV Email — Setup

This add-on does not replace the working timeclock. It adds one scheduled report.

## What it does

Every Sunday, Vercel calls:

    /api/reports/weekly-help-time

The route:

1. Calculates the previous completed Sunday–Saturday week in `America/New_York`.
2. Pulls completed Help Time entries from Supabase.
3. Produces exactly these CSV columns:

    Employee,Date,Start,Stop,Hours

4. Calculates Hours as the duration from Start to Stop, in decimal hours.
5. Emails the CSV to:

    paytransparencyautomation@gmail.com

6. Records the send in `weekly_report_runs`.
7. Refuses to send the same completed week twice after it has been recorded as sent.

The Resend request also uses an idempotency key as an additional duplicate-send safeguard.

## Schedule

`vercel.json` contains:

    0 13 * * 0

Vercel cron schedules use UTC. This runs every Sunday at 13:00 UTC, which is:
- 9:00 AM Eastern during daylight saving time
- 8:00 AM Eastern during standard time

The report period itself is always calculated in `America/New_York`, so DST does not change which Sunday–Saturday dates are included.

## 1. Copy the new files into the app

From the root of your existing Help Time project, copy:

    app/api/reports/weekly-help-time/route.js
    supabase/weekly-report.sql
    vercel.json

If your project already has a `vercel.json`, merge the `crons` section instead of overwriting it.

## 2. Create the Supabase audit table

In Supabase:

SQL Editor → New query

Paste and run:

    supabase/weekly-report.sql

This creates `weekly_report_runs`. It does not alter existing employee or Help Time data.

## 3. Create a Resend account and sender

Create a Resend account and API key.

For production, verify a sender domain in Resend and choose a From address on that domain, for example:

    Help Time Reports <reports@yourcompanydomain.com>

Resend supports Base64 attachments, which this route uses for the CSV.

## 4. Add four Vercel environment variables

In Vercel → Project → Settings → Environment Variables:

    RESEND_API_KEY
    WEEKLY_REPORT_FROM
    WEEKLY_REPORT_TO
    CRON_SECRET

Use:

    WEEKLY_REPORT_TO=paytransparencyautomation@gmail.com

Generate CRON_SECRET locally with:

    openssl rand -base64 48

Do not put any of these secrets in GitHub.

`CRON_SECRET` is also used by Vercel to authenticate cron requests to the route.

## 5. Add the same values locally if you want to test

Put the four variables in `.env.local`.

`.env.local` should remain ignored by Git.

## 6. Commit and push

After copying the files:

    git status
    git add app/api/reports/weekly-help-time/route.js supabase/weekly-report.sql vercel.json
    git commit -m "Add weekly Help Time CSV email report"
    git push

Vercel should redeploy automatically.

## 7. Test before waiting for Sunday

After the new deployment is Ready:

    export APP_URL='https://YOUR-PRODUCTION-DOMAIN'
    export CRON_SECRET='YOUR-CRON-SECRET'
    bash scripts/test-weekly-report.sh

Or use curl directly:

    curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
      https://YOUR-PRODUCTION-DOMAIN/api/reports/weekly-help-time

The route always reports the previous completed Sunday–Saturday period.

## 8. Confirm the result

Check:

- The email arrives at `paytransparencyautomation@gmail.com`.
- The attachment contains exactly:
  `Employee,Date,Start,Stop,Hours`
- Times display in Eastern Time.
- `Hours` is decimal total duration for each entry.
- Supabase `weekly_report_runs` contains a row with status `sent`.
- Resend's dashboard shows the sent email and attachment.

## Important duplicate-send behavior

Once `weekly_report_runs.status = 'sent'` for a week, calling the route again returns a successful "skipped" response instead of sending another email.

If a send fails, the row is marked `failed`, and a later retry can try again.

Resend's idempotency key provides a second layer of duplicate protection for retries within its idempotency window.
