# Help Time Clock — Production Version

A deployable employee Help Time clock using Next.js + Supabase.

## What is included

- Employee name + PIN sign-in
- Start Help Time / Stop Help Time
- Optional notes
- Centralized PostgreSQL storage in Supabase
- Recent employee history
- Separate admin/payroll page
- From/To date filtering
- CSV export
- Server-side authentication cookies
- Double in-punch prevention enforced by a PostgreSQL partial unique index
- Double out-punch rejection
- Database constraint requiring clock-out to be later than clock-in
- Basic login rate limiting

## Security model

The Supabase service-role key is used only on the Next.js server. It is never exposed to browser JavaScript.
The browser communicates only with `/api/...` routes.

Employee PINs are not stored in plaintext. They are hashed with a server-side pepper before storage.

## 1. Create Supabase project

Create a project at Supabase.

Open SQL Editor and run:

    supabase/schema.sql

## 2. Configure local environment

Copy:

    .env.example

to:

    .env.local

Fill in all five variables.

Use long random values for SESSION_SECRET and EMPLOYEE_PIN_PEPPER.

## 3. Add employees

Install dependencies first:

    npm install

Generate a PIN hash:

    EMPLOYEE_PIN_PEPPER="YOUR_PEPPER" npm run hash-pin -- 4821

Copy the hash and add the employee with SQL:

    insert into public.employees (display_name, pin_hash)
    values ('Employee Name', 'HASH_FROM_COMMAND');

Use a different PIN for each employee.

## 4. Test locally

    npm run dev

Open:

    http://localhost:3000

Admin view:

    http://localhost:3000/admin

## 5. Deploy to Vercel

Push this folder to a GitHub repository, import that repository into Vercel, and add these server-side Environment Variables in the Vercel project:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SESSION_SECRET
- EMPLOYEE_PIN_PEPPER
- ADMIN_PASSWORD

Do NOT prefix any of these with NEXT_PUBLIC_.

Deploy.

## Validation behavior

### Double in-punch
A PostgreSQL partial unique index allows only one `clock_out IS NULL` record per employee. If an employee double-taps, reloads, or uses another device, the second insert is rejected.

### Double out-punch
Clock-out updates only an open record. If no open record exists, the server rejects the request.

### Invalid chronological record
A database CHECK constraint rejects any record whose clock-out is not later than clock-in.

### Duplicate UI submissions
The database remains authoritative even if two requests reach the server nearly simultaneously.

## Recommended operating procedure

Before rollout:
1. Create the production Supabase project.
2. Add all employees and PINs.
3. Deploy to Vercel.
4. Test one employee punch from two different phones.
5. Test double in and double out.
6. Test a date-range CSV export.
7. Bookmark the production URL on employee phones.

## Important note on payroll

This app records Help Time activity; it does not calculate wages or modify Workday. Review/export the CSV and use the approved payroll process for transferring Help Time into Workday.
