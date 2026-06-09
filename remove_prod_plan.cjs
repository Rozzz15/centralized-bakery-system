const fs = require("fs");
const path = "src/components/DecoDashboard.tsx";
let code = fs.readFileSync(path, "utf8");
const orig = code;

// 1. Fix types import - remove RecipeDemand, BatchCalculation, OutputAllocation, ProductionPlan (keep BufferStockEntry)
code = code.replace(
  "import type { ProductionTask, DOSItem, ProductRecipe, InventoryItem, FreezerItem, FreezerHistory, Role, WasteLog, RecipeDemand, BatchCalculation, OutputAllocation, BufferStockEntry, ProductionPlan } from \"../types\";",
  "import type { ProductionTask, DOSItem, ProductRecipe, InventoryItem, FreezerItem, FreezerHistory, Role, WasteLog, BufferStockEntry } from \"../types\";"
);

// 2. Remove production-calculation import
code = code.replace(
  "import { aggregateRecipeDemand, calculateBatches, allocateOutput, createBufferStockEntries, getAvailableBuffer, sumIngredients, sumPackaging, sumDecoSupplies } from \"../utils/production-calculation\";\n",
  ""
);

// 3. Remove Production Plan state (lines 301-309 area), including the first buffer stock load
const prodPlanStateStart = "  // Production Plan state";
const prodPlanStateEnd = "  const [confirmingPlan, setConfirmingPlan] = useState(false);";
const prodPlanStateBlock = code.substring(
  code.indexOf(prodPlanStateStart),
  code.indexOf(prodPlanStateEnd) + prodPlanStateEnd.length
);
code = code.replace(prodPlanStateBlock + "\n", "");

// 4. Remove the first buffer stock load effect (now orphaned after removing Production Plan state)
const bufferLoad1 = `  // Load buffer stock on mount\r?\n  useEffect\(\(\) => {\r?\n    db\.fetchAvailableBufferStock\(\)\.then\(setPlanBufferStock\)\.catch\(console\.error\);\r?\n  }, \[\]\);\r?\n`;
code = code.replace(new RegExp(bufferLoad1), "");

// 5. Remove the plan draft useEffect
const planDraftEffectStart = "  // Build production plan draft when DOS items or recipes change";
const planDraftEffectEnd = "  }, [dosItems, recipes, inventory, planBufferStock]);";
const planDraftBlock = code.substring(
  code.indexOf(planDraftEffectStart),
  code.indexOf(planDraftEffectEnd) + planDraftEffectEnd.length
);
code = code.replace(planDraftBlock + "\n", "");

// 6. Remove the second buffer stock load effect
const bufferLoad2 = `  // Load buffer stock on mount\r?\n  useEffect\(\(\) => {\r?\n    db\.fetchAvailableBufferStock\(\)\.then\(setBufferStockItems\)\.catch\(console\.error\);\r?\n  }, \[\]\);\r?\n`;
code = code.replace(new RegExp(bufferLoad2), "");

// 7. Remove "production-plan" from workflowSteps
code = code.replace(
  "    { id: \"production-plan\", label: \"Production Plan\" },\n",
  ""
);

// 8. Fix Dashboard "Next:" button - change from setActiveTab("production-plan") to setActiveTab("tasks-to-prepare")
// The button text says "Next: Tasks to Prepare →" but onClick goes to production-plan (bug)
code = code.replace(
  `            onClick={() => setActiveTab("production-plan")}\n            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all"\n          >\n            Next: Tasks to Prepare →`,
  `            onClick={() => setActiveTab("tasks-to-prepare")}\n            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all"\n          >\n            Next: Tasks to Prepare →`
);

// 9. Fix Tasks-to-Prepare "Next:" button - change from production-plan to advanced-premix
code = code.replace(
  `            <button onClick={() => setActiveTab("production-plan")} className="rounded-xl bg-zinc-800 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-700 transition-all">Next: Production Plan \\u2192</button>`,
  `            <button onClick={() => setActiveTab("advanced-premix")} className="rounded-xl bg-zinc-800 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-700 transition-all">Next: Advanced Premix \\u2192</button>`
);

// 10. Update hardcoded step numbers: "Step X of 6" → "Step X of 5"
code = code.replace(/Step (\d+) of 6/g, "Step $1 of 5");

// 11. Remove the entire Production Plan Panel section
// From "/* ── Production Plan Panel ── */" through the closing brace before "/* ── Advanced Premix ── */"
const prodPlanSectionStart = "  /* ── Production Plan Panel ── */";
const advPremixStart = "  /* ── Advanced Premix ── */";
const startIdx = code.indexOf(prodPlanSectionStart);
const endIdx = code.lastIndexOf(advPremixStart);

if (startIdx >= 0 && endIdx > startIdx) {
  // Remove everything from the Production Plan start to just before Advanced Premix
  const before = code.substring(0, startIdx);
  const after = code.substring(endIdx);
  code = before + after;
  console.log("Removed Production Plan Panel section (lines", startIdx, "to", endIdx, ")");
} else {
  console.log("Could not find Production Plan or Advanced Premix section boundaries!");
  console.log("startIdx:", startIdx, "endIdx:", endIdx);
}

if (code === orig) {
  console.log("NO CHANGES WERE MADE!");
} else {
  fs.writeFileSync(path, code, "utf8");
  console.log("Production Plan removed successfully!");
  console.log("File size changed from", orig.length, "to", code.length, "chars");
}
