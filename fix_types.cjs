const fs = require("fs");
const path = "src/components/DecoDashboard.tsx";
let content = fs.readFileSync(path, "utf8");

// Fix 1: Add AdditionalIngredient import after the db import
const oldImport = 'import * as db from "../lib/db";';
const newImport = 'import * as db from "../lib/db";\nimport type { AdditionalIngredient } from "../lib/db";';
if (content.includes(newImport)) {
  console.log("Import already fixed");
} else if (content.includes(oldImport)) {
  content = content.replace(oldImport, newImport);
  console.log("Import fixed");
} else {
  console.log("Could not find import line");
}

// Fix 2: Update DecoProductionPrep type
const oldType = 'type DecoProductionPrep = { dosId: string; productName: string; productQty: number; prepared: boolean; done: boolean };';
const newType = 'type DecoProductionPrep = { dosId: string; productName: string; productQty: number; prepared: boolean; done: boolean; additionalIngredients: AdditionalIngredient[] };';
if (content.includes(newType)) {
  console.log("Type already fixed");
} else if (content.includes(oldType)) {
  content = content.replace(oldType, newType);
  console.log("Type fixed");
} else {
  console.log("Could not find type definition line");
}

fs.writeFileSync(path, content, "utf8");
console.log("File written successfully");
