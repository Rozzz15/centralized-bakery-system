import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix: })()}{financeTab === "purchases" && (
# Should be: })()}
#        {financeTab === "purchases" && (

old = '        })()}{financeTab === "purchases" && ('
new = '        })()}\n        {financeTab === "purchases" && ('

if old in content:
    content = content.replace(old, new, 1)
    print("OK - Fixed missing closing brace")
elif old.replace('\n', '\r\n') in content:
    old_rn = old.replace('\n', '\r\n')
    new_rn = new.replace('\n', '\r\n')
    content = content.replace(old_rn, new_rn, 1)
    print("OK - Fixed missing closing brace (rn)")
else:
    # Try to find it with partial match
    idx = content.find('})()}{financeTab')
    if idx >= 0:
        print(f"Found at {idx}: {repr(content[idx:idx+50])}")
        content = content[:idx+5] + '\n        ' + content[idx+5:]
        print("Fixed manually")
    else:
        print("ERROR: Pattern not found!")

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
