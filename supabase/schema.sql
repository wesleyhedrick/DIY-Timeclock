-- Help Time Clock production schema
-- Run this in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  pin_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists employees_display_name_unique
  on public.employees (lower(display_name));

create table if not exists public.help_time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  clock_in timestamptz not null default now(),
  clock_out timestamptz null,
  notes text null,
  created_at timestamptz not null default now(),
  constraint notes_max_500 check (notes is null or char_length(notes) <= 500),
  constraint stop_after_start check (clock_out is null or clock_out > clock_in)
);

-- Critical validation: an employee can have only one open punch.
create unique index if not exists one_open_help_time_per_employee
  on public.help_time_entries(employee_id)
  where clock_out is null;

create index if not exists help_time_employee_idx
  on public.help_time_entries(employee_id);

create index if not exists help_time_clock_in_idx
  on public.help_time_entries(clock_in);

-- The browser never talks directly to these tables.
-- All access goes through the Next.js server using the service role.
alter table public.employees enable row level security;
alter table public.help_time_entries enable row level security;

revoke all on table public.employees from anon, authenticated;
revoke all on table public.help_time_entries from anon, authenticated;
