const fs = require('fs');

const path = 'src/components/AdminDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix the extra closing brackets at the end of the warehouse section
// Replace the wrong closing pattern with the correct one

const wrongClose = `        </>)
        })}

{/* Receive Modal */}`;

const correctClose = `        </>)}

{/* Receive Modal */}`;

if (content.includes(wrongClose)) {
  content = content.replace(wrongClose, correctClose);
  fs.writeFileSync(path, content, 'utf8');
  console.log('FIXED: Closing brackets corrected');
} else {
  console.log('Pattern not found. Trying alternative...');
  // Debug: show what's around the closing area
  const rmIdx = content.indexOf('{/* Receive Modal */}');
  const before = content.slice(rmIdx - 60, rmIdx);
  console.log('Before Receive Modal:', JSON.stringify(before));
}
