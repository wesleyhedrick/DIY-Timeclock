import fs from "node:fs";
import crypto from "node:crypto";

const pepper = process.env.EMPLOYEE_PIN_PEPPER;

if (!pepper || pepper.length < 16) {
  console.error("EMPLOYEE_PIN_PEPPER is missing.");
  process.exit(1);
}

const input = fs.readFileSync("employee-pins.csv", "utf8").trim();
const lines = input.split(/\r?\n/).slice(1);

const output = ["name,pin_hash"];

for (const line of lines) {
  const comma = line.lastIndexOf(",");
  const name = line.slice(0, comma).trim();
  const pin = line.slice(comma + 1).trim();

  const hash = crypto
    .createHash("sha256")
    .update(`${pepper}:${pin}`)
    .digest("hex");

  output.push(`"${name.replace(/"/g, '""')}",${hash}`);
}

fs.writeFileSync("employee-pin-hashes.csv", output.join("\n"));

console.log("Created employee-pin-hashes.csv");