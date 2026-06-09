const fs = require("fs");
const path = "src/components/DecoDashboard.tsx";
let content = fs.readFileSync(path, "utf8");

const oldLine = "type DecoProductionPrep = { dosId: string; productName: string; productQty: number; prepared: boolean; done: boolean };";
const newLine = "type DecoProductionPrep = { dosId: string; productName: string; productQty: number; prepared: boolean; done: boolean; additionalIngredients: AdditionalIngredient[] };";

const firstIdx = content.indexOf(oldLine);
if (firstIdx >= 0) {
  content = content.substring(0, firstIdx) + newLine + content.substring(firstIdx + oldLine.length);
  fs.writeFileSync(path, content, "utf8");
  console.log("Type definition was updated successfully");
} else {
  console.log("Type definition not found - checking if already updated...");
  if (content.includes(newLine)) {
    console.log("Already updated!");
  } else {
    console.log("Could not find old type definition - content mismatch");
  }
}
