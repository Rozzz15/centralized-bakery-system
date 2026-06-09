const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src", "components", "DecoDashboard.tsx");
let content = fs.readFileSync(filePath, "utf8");
const nl = content.includes("\r\n") ? "\r\n" : "\n";

// Find the wasteQty line and insert toast state after it
const marker = `  const [wasteQty, setWasteQty] = useState<number>(1);`;
const insertion = `  const [wasteQty, setWasteQty] = useState<number>(1);${nl}${nl}  // Toast state${nl}  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);${nl}  const showToast = (message: string, type: "success" | "error" = "success") => {${nl}    setToast({ message, type });${nl}    setTimeout(() => setToast(null), 4000);${nl}  };`;

if (content.includes(marker)) {
  content = content.replace(marker, insertion);
  fs.writeFileSync(filePath, content, "utf8");
  console.log("✅ Toast state added!");
} else {
  console.log("❌ Could not find wasteQty line");
  // Try finding it differently
  const idx = content.indexOf("wasteQty");
  console.log("Found wasteQty at index:", idx);
  console.log("Context:", content.substring(idx - 20, idx + 80));
}
