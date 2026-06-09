const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src", "components", "DecoDashboard.tsx");
let content = fs.readFileSync(filePath, "utf8");

// The first "Next: Production Plan" is the dashboard one (with bg-zinc-900)
// The second is the tasks-to-prepare one (with bg-zinc-800)
// Find and replace just the first occurrence

const search = `            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all"
          >
            Next: Production Plan →`;
const replace = `            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all"
          >
            Next: Tasks to Prepare →`;

if (content.includes(search)) {
  content = content.replace(search, replace);
  console.log("✅ Fixed dashboard Next button!");
} else {
  console.log("❌ Could not find exact pattern");
  // Try with CRLF
  const searchCR = search.replace(/\n/g, "\r\n");
  const replaceCR = replace.replace(/\n/g, "\r\n");
  if (content.includes(searchCR)) {
    content = content.replace(searchCR, replaceCR);
    console.log("✅ Fixed with CRLF");
  } else {
    console.log("❌ Also failed with CRLF");
    // Show what's around line 1240
    const lines = content.split(/\r?\n/);
    for (let i = 1238; i <= 1245 && i < lines.length; i++) {
      console.log("L" + (i+1) + ": " + JSON.stringify(lines[i]));
    }
  }
}

fs.writeFileSync(filePath, content, "utf8");
console.log("Done");
