const fs = require("fs");
const path = "src/components/DecoDashboard.tsx";
let content = fs.readFileSync(path, "utf8");

// Fix push without additionalIngredients (line ~206)
const old1 = 'items.push({ dosId, productName: dos.product, productQty: productQty[dosId] ?? dos.qty, prepared: preMixPrepared.has(key), done: preMixDone.has(key) });';
const new1 = 'items.push({ dosId, productName: dos.product, productQty: productQty[dosId] ?? dos.qty, prepared: preMixPrepared.has(key), done: preMixDone.has(key), additionalIngredients: productAdditionalIngredients[key] ?? [] });';

const old2 = 'items.push({ dosId, productName: r!.productName, productQty: productQty[dosId] ?? dos.qty, prepared: preMixPrepared.has(key), done: preMixDone.has(key) });';
const new2 = 'items.push({ dosId, productName: r!.productName, productQty: productQty[dosId] ?? dos.qty, prepared: preMixPrepared.has(key), done: preMixDone.has(key), additionalIngredients: productAdditionalIngredients[key] ?? [] });';

let count = 0;
if (content.includes(old1)) {
  content = content.replace(old1, new1);
  count++;
  console.log("Fixed first push");
}
if (content.includes(old2)) {
  content = content.replace(old2, new2);
  count++;
  console.log("Fixed second push");
}

if (count > 0) {
  fs.writeFileSync(path, content, "utf8");
  console.log(count + " push(es) fixed");
} else {
  console.log("No fixes needed - pushes already have additionalIngredients");
}
