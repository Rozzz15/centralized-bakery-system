const fs = require("fs");
const path = "src/components/DecoDashboard.tsx";
let code = fs.readFileSync(path, "utf8");

// Fix the task lookup: remove assignedTo filter since route may not match
const oldLookup = `const task = production.find(t => t.product === dos.product && t.assignedTo === route && t.status !== "completed");`;
const newLookup = `const task = production.find(t => t.product === dos.product && t.status !== "completed");`;

if (code.includes(oldLookup)) {
  code = code.replace(oldLookup, newLookup);
  fs.writeFileSync(path, code, "utf8");
  console.log("Fixed task lookup to remove assignedTo filter");
} else {
  console.log("Pattern not found - checking for what's there...");
  const idx = code.indexOf("production.find(t => t.product === dos.product");
  if (idx >= 0) {
    console.log("Found at index", idx);
    console.log("Context:", code.substring(idx, idx + 120));
  } else {
    console.log("Not found!");
  }
}
