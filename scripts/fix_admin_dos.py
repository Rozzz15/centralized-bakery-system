with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the role filter array
old = '(["all", "baker", "deco"] as const)'
new = '(["all", "baker", "deco", "pastry"] as const)'
content = content.replace(old, new)

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done - updated', content.count(new), 'occurrence(s)')
