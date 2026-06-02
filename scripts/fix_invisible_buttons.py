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

    # + Add button: bg-zinc-900 -> bg-white text-zinc-900
    section = section.replace(
        'rounded-lg bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm hover:bg-zinc-800 transition-all">+ Add</button>',
        'rounded-lg bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-900 shadow-sm hover:bg-zinc-100 transition-all">+ Add</button>'
    )

    # Selected filter button: bg-zinc-900 text-white -> bg-white text-zinc-900
    section = section.replace(
        'bg-zinc-900 text-white shadow-sm',
        'bg-white text-zinc-900 shadow-sm'
    )

    content = before + section + after
    print("Invisible buttons fixed")
else:
    print("ERROR: Section markers not found")

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
