-- Weekly Help Time email audit table
-- Run this once in the Supabase SQL Editor.

create table if not exists public.weekly_report_runs (
  week_start date primary key,
  week_end date not null,
  recipient text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  row_count integer not null default 0
    check (row_count >= 0),
  resend_email_id text null,
  error_message text null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null
);

alter table public.weekly_report_runs enable row level security;

revoke all on table public.weekly_report_runs from anon, authenticated;
