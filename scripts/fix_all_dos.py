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

    # Container div
    section = section.replace(
        'className="rounded-[24px] border border-amber-200 bg-amber-50/30 p-5 shadow-sm"',
        'className="rounded-[24px] border border-zinc-700 bg-zinc-900 p-5 shadow-sm"'
    )

    # Title text
    section = section.replace(
        'text-amber-900">Today\'s DOS</span>',
        'text-white">Today\'s DOS</span>'
    )

    # Date badge
    section = section.replace(
        'rounded-full bg-amber-200 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 font-mono',
        'rounded-full bg-zinc-700 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 font-mono'
    )

    # Filter buttons unselected state
    section = section.replace(
        'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
        'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
    )

    # Table head
    section = section.replace(
        'bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500',
        'bg-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-400'
    )

    # Table body
    section = section.replace(
        'divide-y divide-zinc-100 text-[13px]">',
        'divide-y divide-zinc-700 text-[13px]">'
    )

    # Row hover
    section = section.replace(
        'hover:bg-amber-50/40',
        'hover:bg-zinc-800/60'
    )

    # Product name
    section = section.replace(
        'font-medium text-zinc-900">{item.product}</div>',
        'font-medium text-white">{item.product}</div>'
    )

    # Product ID
    section = section.replace(
        'text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.id}',
        'text-[11px] text-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.id}'
    )

    # Edit button
    section = section.replace(
        'rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-all">Edit</button>',
        'rounded-lg border border-zinc-600 px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all">Edit</button>'
    )

    # Del button
    section = section.replace(
        'rounded-lg border border-red-200 px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 hover:border-red-300 transition-all">Del</button>',
        'rounded-lg border border-red-700 px-2 py-1 text-[11px] text-red-400 hover:bg-red-900/30 hover:border-red-500 transition-all">Del</button>'
    )

    # Empty state text
    section = section.replace(
        'text-center py-10 text-[13px] text-zinc-400">',
        'text-center py-10 text-[13px] text-zinc-500">'
    )

    # Quantity text (in the td)
    section = section.replace(
        'text-right font-medium" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.qty}</td>',
        'text-right font-medium text-white" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.qty}</td>'
    )

    # reassemble
    content = before + section + after
    print("Today's DOS section updated successfully")
else:
    if start_idx < 0:
        print(f"ERROR: Start marker '{start_marker}' not found!")
    else:
        print(f"ERROR: End marker '{end_marker}' not found or before start (start={start_idx}, end={end_idx})")

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
