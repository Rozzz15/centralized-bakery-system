const fs = require("fs");
const path = "src/components/DecoDashboard.tsx";
let content = fs.readFileSync(path, "utf8");

// Find and fix two specific patterns
const pattern1 = /items\.push\(\{ dosId, productName: dos\.product, productQty: productQty\[dosId\] \?\? dos\.qty, prepared: preMixPrepared\.has\(key\), done: preMixDone\.has\(key\) \}\)/g;
const pattern2 = /items\.push\(\{ dosId, productName: r!\.productName, productQty: productQty\[dosId\] \?\? dos\.qty, prepared: preMixPrepared\.has\(key\), done: preMixDone\.has\(key\) \}\)/g;

const replacement1 = 'items.push({ dosId, productName: dos.product, productQty: productQty[dosId] ?? dos.qty, prepared: preMixPrepared.has(key), done: preMixDone.has(key), additionalIngredients: productAdditionalIngredients[key] ?? [] })';
const replacement2 = 'items.push({ dosId, productName: r!.productName, productQty: productQty[dosId] ?? dos.qty, prepared: preMixPrepared.has(key), done: preMixDone.has(key), additionalIngredients: productAdditionalIngredients[key] ?? [] })';

const matches1 = content.match(pattern1);
const matches2 = content.match(pattern2);
console.log("Pattern1 matches:", matches1?.length || 0);
console.log("Pattern2 matches:", matches2?.length || 0);

let updated = content;
if (matches1?.length) {
  updated = updated.replace(pattern1, replacement1);
  console.log("Fixed first push");
}
if (matches2?.length) {
  updated = updated.replace(pattern2, replacement2);
  console.log("Fixed second push");
}

if (updated !== content) {
  fs.writeFileSync(path, updated, "utf8");
  console.log("File saved");
} else {
  console.log("No changes needed");
}
