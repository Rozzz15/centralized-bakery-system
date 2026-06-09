const fs = require("fs");
const path = "src/components/DecoDashboard.tsx";
let code = fs.readFileSync(path, "utf8");
const orig = code;

// 1. Fix the Props type: change onUpdateProduction from callback-setter to (taskId, updates) pattern
code = code.replace(
  "  onUpdateProduction?: (cb: ProductionTask[] | ((prev: ProductionTask[]) => ProductionTask[])) => void;",
  "  onUpdateProduction?: (taskId: string, updates: Partial<ProductionTask>) => void;"
);

// 2. Add onUpdateProduction usage in handleComplete (before setActivePreparation(null))
// Find the line "setActivePreparation(null);" inside the preparation view's handleComplete
// The pattern is unique enough: after showToast there's "setActivePreparation(null);"
code = code.replace(
  "      setActivePreparation(null);\n    };\n\n    return (",
  "      // Update production task status\n      if (onUpdateProduction) {\n        const task = production.find(t => t.product === dos.product && t.assignedTo === route && t.status !== \"completed\");\n        if (task) onUpdateProduction(task.id, { status: \"completed\", completed: output });\n      }\n      setActivePreparation(null);\n    };\n\n    return ("
);

if (code === orig) {
  console.log("NO CHANGES WERE MADE - pattern matching failed!");
  console.log("Trying to find 'setActivePreparation(null);' ...");
  const idx = code.indexOf("setActivePreparation(null);");
  if (idx >= 0) {
    console.log("Found at index", idx);
    console.log("Context:", code.substring(idx - 100, idx + 100));
  } else {
    console.log("Not found!");
  }
} else {
  fs.writeFileSync(path, code, "utf8");
  console.log("Changes applied successfully!");
}
