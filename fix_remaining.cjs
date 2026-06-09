const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src", "components", "DecoDashboard.tsx");
let content = fs.readFileSync(filePath, "utf8");

// Fix 1: Update workflowSteps to include tasks-to-prepare
const oldSteps = `  const workflowSteps = [
    { id: "dashboard", label: "DOS Received" },
    { id: "production-plan", label: "Production Plan" },
    { id: "advanced-premix", label: "Advanced Premix" },
    { id: "deco-queue", label: "Decoration Queue" },
    { id: "freezer", label: "Finished Products" },
  ];`;
const newSteps = `  const workflowSteps = [
    { id: "dashboard", label: "DOS Received" },
    { id: "tasks-to-prepare", label: "Tasks to Prepare" },
    { id: "production-plan", label: "Production Plan" },
    { id: "advanced-premix", label: "Advanced Premix" },
    { id: "deco-queue", label: "Decoration Queue" },
    { id: "freezer", label: "Finished Products" },
  ];`;
if (content.includes(oldSteps)) {
  content = content.replace(oldSteps, newSteps);
  console.log("✅ Fix 1: Updated workflowSteps to 6 steps");
} else {
  console.log("❌ Fix 1: Could not find workflowSteps");
  // Try with \r\n
  const oldStepsCR = oldSteps.replace(/\n/g, "\r\n");
  if (content.includes(oldStepsCR)) {
    content = content.replace(oldStepsCR, newSteps.replace(/\n/g, "\r\n"));
    console.log("✅ Fix 1 (CRLF): Updated workflowSteps");
  } else {
    console.log("❌ Fix 1: Also failed with CRLF");
  }
}

// Fix 2: Dashboard step indicator - "Step 1 of 5" → "Step 1 of 6"
let count = 0;
content = content.replace('Step 1 of 5</div>', (match) => {
  count++;
  return 'Step 1 of 6</div>';
});
console.log("✅ Fix 2: Updated " + count + " 'Step 1 of 5' occurrences");

// Fix 3: Dashboard "Next: Production Plan" → "Next: Tasks to Prepare"
count = 0;
// Find the first one in the dashboard section
const dashNav = `onClick={() => setActiveTab("production-plan")}
            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all"
          >
            Next: Production Plan \u2192`;
const dashNavNew = `onClick={() => setActiveTab("tasks-to-prepare")}
            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all"
          >
            Next: Tasks to Prepare \u2192`;
if (content.includes(dashNav)) {
  content = content.replace(dashNav, dashNavNew);
  console.log("✅ Fix 3: Updated dashboard Next button");
} else {
  console.log("❌ Fix 3: Could not find dashboard Next button");
}

// Fix 4: Production Plan "Step 2 of 5" → "Step 3 of 6" (BUT NOT Step 2 of 4 or others)
count = 0;
content = content.replace(/>Step 2 of 5</g, () => { count++; return ">Step 3 of 6<"; });
console.log("✅ Fix 4: Updated " + count + " 'Step 2 of 5' occurrences");

// Fix 5: Check for any remaining old step numbers
const matches = content.match(/Step \d+ of 5/g);
if (matches) {
  console.log("⚠️ Remaining 'Step X of 5' instances:", matches.join(", "));
} else {
  console.log("✅ No remaining 'Step X of 5' strings");
}

const matches6 = content.match(/Step \d+ of 6/g);
if (matches6) {
  console.log("ℹ️ Current 'Step X of 6' instances:", matches6.join(", "));
}

fs.writeFileSync(filePath, content, "utf8");
console.log("\n✅ All remaining fixes applied!");
