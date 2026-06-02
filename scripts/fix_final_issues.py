with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix React import to include default import
old_import = 'import { useEffect, useRef, useState } from "react";'
new_import = 'import React, { useEffect, useRef, useState } from "react";'
if old_import in content:
    content = content.replace(old_import, new_import, 1)
    print('SUCCESS: React import updated')
else:
    print('FAILED: Could not find old import')

# 2. Remove duplicate Modal definition
# Find the first Modal definition
first_modal = '''function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-[16px] font-semibold">{title}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
'''

# Count occurrences
count = content.count(first_modal)
print(f'Modal component found {count} times')

if count > 1:
    # Find all occurrences and remove the second one
    # Replace with a marker, then remove the duplicate
    parts = content.split(first_modal)
    if len(parts) >= 3:
        # Keep first occurrence, remove duplicates
        content = parts[0] + first_modal + ''.join(parts[2:])
        print('SUCCESS: Duplicate Modal definition removed')
    else:
        print('Could not split by Modal definition')
else:
    print('No duplicate Modal found')

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

total_lines = len(content.splitlines())
print(f'Total lines: {total_lines}')

# Verify
if 'function Modal' in content:
    # Count Modal function definitions
    import re
    modal_count = len(re.findall(r'function Modal\(', content))
    print(f'Modal function definitions remaining: {modal_count}')
