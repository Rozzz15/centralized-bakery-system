const fs = require('fs');

const path = 'src/components/AdminDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// Remove the orphaned </div> at line 1132 (8 spaces indent)
// It's right before Pending Material Requests

const orphanDiv = '        </div>\n\n\n              {/* Pending Material Requests */}';
const fixed = '\n\n              {/* Pending Material Requests */}';

if (content.includes(orphanDiv)) {
  content = content.replace(orphanDiv, fixed);
  fs.writeFileSync(path, content, 'utf8');
  console.log('FIXED: Removed orphaned closing div tag');
} else {
  console.log('Pattern not found. Trying with different spacing...');
  const pmrIdx = content.indexOf('{/* Pending Material Requests */}');
  const before = content.slice(pmrIdx - 30, pmrIdx);
  console.log('Before Pending Material Requests:', JSON.stringify(before));
}
