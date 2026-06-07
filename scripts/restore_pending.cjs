const fs = require('fs');

const path = 'src/components/AdminDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// The restore script added extra </div> tags that don't match any opening tags
// Find and remove the duplicate closing divs before "Pending Material Requests"

// Pattern: the items container is already closed, then there are 2 extra </div> tags
// followed by the pending requests section
const problemPattern = `              </div>

              {/* Pending Material Requests */}`;

const correctPattern = `

              {/* Pending Material Requests */}`;

if (content.includes(problemPattern)) {
  // Replace only the first occurrence (the problematic one in the warehouse section)
  const idx = content.indexOf(problemPattern);
  content = content.slice(0, idx) + correctPattern + content.slice(idx + problemPattern.length);
  fs.writeFileSync(path, content, 'utf8');
  console.log('FIXED: Removed extra closing div tags before Pending Material Requests');
} else {
  console.log('Pattern not found, trying alternative approach...');
  // Check what's before "Pending Material Requests"
  const pmrIdx = content.indexOf('{/* Pending Material Requests */}');
  const before = content.slice(pmrIdx - 100, pmrIdx);
  console.log('Before Pending Material Requests:', JSON.stringify(before));
}
