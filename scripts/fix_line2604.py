import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 2604 (0-indexed: 2603) should be: "        })()}"
# Currently it is: "        })()"
print(f"Line 2604 content: {repr(lines[2603].rstrip())}")

# Fix it
if lines[2603].rstrip() == '        })()':
    lines[2603] = '        })()}\n'
    print("Fixed: Added missing closing brace")
else:
    print(f"Unexpected content, not fixing")

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Done")
