import crypto from "node:crypto";

const pin=process.argv[2];
const pepper=process.env.EMPLOYEE_PIN_PEPPER;

if(!pin || !/^\d{4,12}$/.test(pin)) {
  console.error("Usage: EMPLOYEE_PIN_PEPPER='your-secret' npm run hash-pin -- 4821");
  process.exit(1);
}
if(!pepper || pepper.length<16) {
  console.error("EMPLOYEE_PIN_PEPPER must be set and at least 16 characters.");
  process.exit(1);
}

console.log(crypto.createHash("sha256").update(`${pepper}:${pin}`).digest("hex"));
