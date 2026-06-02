with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "{/* Today's DOS */}"
end_marker = "{/* Scheduled DOS */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx >= 0 and end_idx > start_idx:
    before = content[:start_idx]
    section = content[start_idx:end_idx]
    after = content[end_idx:]

    # Status text: completed - emerald-700 -> emerald-400
    section = section.replace(
        'text-emerald-700" : item.status === "in-progress" ? "text-amber-700" : "text-zinc-500',
        'text-emerald-400" : item.status === "in-progress" ? "text-amber-400" : "text-zinc-400'
    )

    content = before + section + after
    print("Status colors updated")
else:
    print("ERROR: Section markers not found")

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
