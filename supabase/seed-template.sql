-- 1) Generate each PIN hash locally:
--    EMPLOYEE_PIN_PEPPER="same-secret-as-vercel" npm run hash-pin -- 4821
--
-- 2) Paste the resulting hash below.
-- Repeat one row per employee.

insert into public.employees (display_name, pin_hash)
values
  ('Example Employee', 'PASTE_HASH_HERE');
