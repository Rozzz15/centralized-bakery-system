with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Check line endings
has_crlf = '\r\n' in content

# The ending with CRLF
old_ending_lf = '    </div>\n  );\n}\n'
old_ending_crlf = '    </div>\r\n  );\r\n}\r\n'

new_ending_lf = '''    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
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

if has_crlf:
    new_ending_crlf = new_ending_lf.replace('\n', '\r\n')
    if old_ending_crlf in content:
        content = content.replace(old_ending_crlf, new_ending_crlf, 1)
        print('SUCCESS: Modal component added with CRLF')
    else:
        print(f'FAILED: CRLF old ending not found. Count: {content.count(old_ending_crlf)}')
        # Debug: show what's at the end
        print(repr(content[-100:]))
else:
    if old_ending_lf in content:
        content = content.replace(old_ending_lf, new_ending_lf, 1)
        print('SUCCESS: Modal component added with LF')
    else:
        print(f'FAILED: LF old ending not found. Count: {content.count(old_ending_lf)}')
        print(repr(content[-100:]))

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

total_lines = len(content.splitlines())
print(f'Total lines: {total_lines}')
