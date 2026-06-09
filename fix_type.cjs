const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src", "components", "DecoDashboard.tsx");
let content = fs.readFileSync(filePath, "utf8");

// Fix 1: Add source to newAddIngredient state
const oldState = `const [newAddIngredient, setNewAddIngredient] = useState<{ name: string; qty: number; unit: string; reason: string }>({ name: "", qty: 0, unit: "", reason: "" });`;
const newState = `const [newAddIngredient, setNewAddIngredient] = useState<{ name: string; qty: number; unit: string; reason: string; source: string }>({ name: "", qty: 0, unit: "", reason: "", source: "" });`;
content = content.replace(oldState, newState);

// Fix 2: Add source to the spread in the add handler
// Need to find both places where newAddIngredient is reset
const oldReset1 = `setNewAddIngredient({ name: "", qty: 0, unit: "", reason: "" });`;
const newReset1 = `setNewAddIngredient({ name: "", qty: 0, unit: "", reason: "", source: "" });`;
content = content.replace(oldReset1, newReset1);

fs.writeFileSync(filePath, content, "utf8");
console.log("✅ Fixed AdditionalIngredient type mismatch");
