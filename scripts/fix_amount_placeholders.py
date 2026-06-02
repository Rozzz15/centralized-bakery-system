import re

path = "src/components/AdminDashboard.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix Purchase Amount input
content = content.replace(
    'type="number" value={editingPurchase.amount} onChange={e => setEditingPurchase({...editingPurchase, amount: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" />',
    'type="number" value={editingPurchase.amount || ""} onChange={e => setEditingPurchase({...editingPurchase, amount: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="0" />'
)

# Fix Bill Amount input
content = content.replace(
    'type="number" value={editingBill.amount} onChange={e => setEditingBill({...editingBill, amount: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" />',
    'type="number" value={editingBill.amount || ""} onChange={e => setEditingBill({...editingBill, amount: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="0" />'
)

# Fix Revenue Amount input
content = content.replace(
    'type="number" value={editingRevenue.amount} onChange={e => setEditingRevenue({...editingRevenue, amount: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" />',
    'type="number" value={editingRevenue.amount || ""} onChange={e => setEditingRevenue({...editingRevenue, amount: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="0" />'
)

# Fix Waste QtyRejected input
content = content.replace(
    'type="number" value={editingWaste.qtyRejected} onChange={e => setEditingWaste({...editingWaste, qtyRejected: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" />',
    'type="number" value={editingWaste.qtyRejected || ""} onChange={e => setEditingWaste({...editingWaste, qtyRejected: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="0" />'
)

# Fix Waste UnitCost input
content = content.replace(
    'type="number" value={editingWaste.unitCost} onChange={e => { const c = Number(e.target.value); setEditingWaste({...editingWaste, unitCost: c, totalCost: c * editingWaste.qtyRejected}); }} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" />',
    'type="number" value={editingWaste.unitCost || ""} onChange={e => { const c = Number(e.target.value); setEditingWaste({...editingWaste, unitCost: c, totalCost: c * editingWaste.qtyRejected}); }} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="0" />'
)

with open(path, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(content)

print("All 5 Amount inputs fixed successfully!")
