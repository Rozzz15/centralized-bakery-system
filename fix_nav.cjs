const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src", "components", "DecoDashboard.tsx");
let content = fs.readFileSync(filePath, "utf8");

// Fix the DASHBOARD Next button - first occurrence should point to tasks-to-prepare
// Looking for: onClick={() => setActiveTab("production-plan")}
// In the dashboard section, change to setActiveTab("tasks-to-prepare")
// But only the FIRST occurrence in the dashboard section, not the tasks-to-prepare section

// The dashboard section has the comment, then if block, then the return
// The tasks-to-prepare section also has "Next: Production Plan" which should stay

// Find the dashboard's Next button (it uses bg-zinc-900 styling)
const oldDash = `          <div className="flex items-center justify-between pt-4 border-t border-zinc-100">\n          <div className="text-[12px] text-zinc-400">Step 1 of 6</div>\n          <button\n            onClick={() => setActiveTab("production-plan")}\n            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all"\n          >\n            Next: Production Plan →\n          </button>\n        </div>`;

const newDash = `          <div className="flex items-center justify-between pt-4 border-t border-zinc-100">\n          <div className="text-[12px] text-zinc-400">Step 1 of 6</div>\n          <button\n            onClick={() => setActiveTab("tasks-to-prepare")}\n            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all"\n          >\n            Next: Tasks to Prepare →\n          </button>\n        </div>`;

if (content.includes(oldDash)) {
  content = content.replace(oldDash, newDash);
  console.log("✅ Fixed dashboard Next button");
} else {
  console.log("❌ Could not find dashboard Next button pattern");
  // Try with \\r\\n
  const oldDashCR = oldDash.replace(/\n/g, "\r\n");
  const newDashCR = newDash.replace(/\n/g, "\r\n");
  if (content.includes(oldDashCR)) {
    content = content.replace(oldDashCR, newDashCR);
    console.log("✅ Fixed dashboard Next button (CRLF)");
  } else {
    console.log("❌ Also failed with CRLF");
  }
}

fs.writeFileSync(filePath, content, "utf8");
console.log("Done");
