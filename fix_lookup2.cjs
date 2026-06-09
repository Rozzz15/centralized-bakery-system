const fs = require("fs");
const path = "src/components/DecoDashboard.tsx";
let code = fs.readFileSync(path, "utf8");

// Fix the task lookup: use assignedTo === "deco" for precision
const oldLookup = `const task = production.find(t => t.product === dos.product && t.status !== "completed");`;
const newLookup = `const task = production.find(t => t.product === dos.product && t.assignedTo === "deco" && t.status !== "completed");`;

if (code.includes(oldLookup)) {
  code = code.replace(oldLookup, newLookup);
  fs.writeFileSync(path, code, "utf8");
  console.log("Fixed task lookup to use assignedTo === 'deco'");
} else {
  console.log("Pattern not found!");
}
