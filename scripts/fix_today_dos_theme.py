with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Container - Today's DOS
content = content.replace(
    '<div className="rounded-[24px] border border-amber-200 bg-amber-50/30 p-5 shadow-sm">',
    '<div className="rounded-[24px] border border-zinc-700 bg-zinc-900 p-5 shadow-sm">'
)

# Title "Today's DOS"
content = content.replace(
    '<span className="text-[16px] font-semibold text-amber-900">Today\'s DOS</span>',
    '<span className="text-[16px] font-semibold text-white">Today\'s DOS</span>'
)

# Date badge
content = content.replace(
    'rounded-full bg-amber-200 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 font-mono',
    'rounded-full bg-zinc-700 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 font-mono'
)

# Filter buttons (unselected state within Today's DOS section only - need unique context)
# bg-zinc-100 text-zinc-600 hover:bg-zinc-200 -> bg-zinc-800 text-zinc-300 hover:bg-zinc-700
# This is generic so let me be careful. The filter buttons are inside the Today's DOS container.
# Let me replace only the specific filter button classes within the Today's DOS context
# Actually the bg-zinc-100 appears elsewhere, so let me handle it differently

# Instead of replacing generic classes, let me replace at the block level
# Search for the specific line with the filter buttons and update it

# The filter buttons line has: bg-zinc-100 text-zinc-600 hover:bg-zinc-200
# Class for unselected: "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
# Class for selected: "bg-zinc-900 text-white shadow-sm"
# Since bg-zinc-900 text-white already works on dark bg, only unselected needs update

# Let me replace the unselected state
content = content.replace(
    'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
    'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
)

# Table head
content = content.replace(
    '<thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Assigned To</th><th className="px-4 py-3 text-right">Status</th><th className="px-4 py-3 w-10" /></tr></thead>',
    '<thead className="bg-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }}><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Assigned To</th><th className="px-4 py-3 text-right">Status</th><th className="px-4 py-3 w-10" /></tr></thead>'
)

# Table body divide and text
content = content.replace(
    '<tbody className="divide-y divide-zinc-100 text-[13px]">',
    '<tbody className="divide-y divide-zinc-700 text-[13px]">'
)

# Row hover - only the ones in the today's dos table (hover:bg-amber-50/40)
# Need to be more careful since this is generic. Let me replace all instances
# since this hover class is used throughout.
content = content.replace(
    'className="hover:bg-amber-50/40"',
    'className="hover:bg-zinc-800/60"'
)

# Product name in dark card
content = content.replace(
    '<div className="font-medium text-zinc-900">{item.product}</div><div className="text-[11px] text-zinc-500"',
    '<div className="font-medium text-white">{item.product}</div><div className="text-[11px] text-zinc-400"'
)

# Edit button in Today's DOS
content = content.replace(
    'border border-zinc-200 px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-all">Edit</button>',
    'border border-zinc-600 px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all">Edit</button>'
)

# Delete button in Today's DOS  
content = content.replace(
    'border border-red-200 px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 hover:border-red-300 transition-all">Del</button>',
    'border border-red-700 px-2 py-1 text-[11px] text-red-400 hover:bg-red-900/30 hover:border-red-500 transition-all">Del</button>'
)

# Empty state message for Today's DOS (colSpan=8)
content = content.replace(
    '<td colSpan={8} className="text-center py-10 text-[13px] text-zinc-400">',
    '<td colSpan={8} className="text-center py-10 text-[13px] text-zinc-500">'
)

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
