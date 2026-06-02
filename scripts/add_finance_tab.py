import re

with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find insertion point - after pricing section closing  
old = '''      </div>
    );
  }

  /* ── Default: Admin Dashboard ── */

  function handleExport() {
'''

# Read the finance section from a separate file
new = '''      </div>
    );
  }

  if (activeTab === "finance") {
    const totalPurchases = purchases.reduce((s, p) => s + p.amount, 0);
    const unpaidPurchases = purchases.filter(p => p.paymentStatus === "unpaid" || p.paymentStatus === "overdue");
    const totalBills = billsAndDues.reduce((s, b) => s + b.amount, 0);
    const pendingBills = billsAndDues.filter(b => b.status === "pending" || b.status === "overdue");
    const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
    const totalWaste = wasteLog.reduce((s, w) => s + w.totalCost, 0);

    const [showAddPurchase, setShowAddPurchase] = useState(false);
    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
    const [showAddBill, setShowAddBill] = useState(false);
    const [editingBill, setEditingBill] = useState<BillDue | null>(null);
    const [showAddRevenue, setShowAddRevenue] = useState(false);
    const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
    const [showAddWaste, setShowAddWaste] = useState(false);
    const [editingWaste, setEditingWaste] = useState<WasteLog | null>(null);
    const [financeSearch, setFinanceSearch] = useState("");
    const [financeTab, setFinanceTab] = useState<"purchases" | "bills" | "revenue" | "waste">("purchases");

    const filteredPurchases = purchases.filter(p => p.particular.toLowerCase().includes(financeSearch.toLowerCase()) || p.supplierName.toLowerCase().includes(financeSearch.toLowerCase()));
    const filteredBills = billsAndDues.filter(b => b.particular.toLowerCase().includes(financeSearch.toLowerCase()));
    const filteredRevenue = revenue.filter(r => r.particular.toLowerCase().includes(financeSearch.toLowerCase()));
    const filteredWaste = wasteLog.filter(w => w.product.toLowerCase().includes(financeSearch.toLowerCase()) || w.reason.toLowerCase().includes(financeSearch.toLowerCase()));

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div><h1 className="text-[24px] font-semibold">Finance</h1><p className="mt-1 text-[13px] text-zinc-600">Track purchases, bills, revenue, and waste across all operations.</p></div>
          <div className="relative">
            <input type="text" placeholder="Search..." value={financeSearch} onChange={e => setFinanceSearch(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 pl-9 text-[13px] outline-none focus:border-zinc-400 w-64" />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Total Purchases</div>
            <div className="text-[24px] font-semibold mt-1">&euro;{totalPurchases.toLocaleString()}</div>
            <div className="text-[11px] text-zinc-400 mt-1">{unpaidPurchases.length} unpaid/overdue</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Bills &amp; Dues</div>
            <div className="text-[24px] font-semibold mt-1">&euro;{totalBills.toLocaleString()}</div>
            <div className="text-[11px] text-zinc-400 mt-1">{pendingBills.length} pending/overdue</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Revenue</div>
            <div className="text-[24px] font-semibold mt-1 text-emerald-600">&euro;{totalRevenue.toLocaleString()}</div>
            <div className="text-[11px] text-zinc-400 mt-1">{revenue.length} entries</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Waste Cost</div>
            <div className="text-[24px] font-semibold mt-1 text-red-600">&euro;{totalWaste.toLocaleString()}</div>
            <div className="text-[11px] text-zinc-400 mt-1">{wasteLog.length} entries</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 border-b border-zinc-200">
          {([
            { id: "purchases", label: "Purchases", count: purchases.length },
            { id: "bills", label: "Bills &amp; Dues", count: billsAndDues.length },
            { id: "revenue", label: "Revenue", count: revenue.length },
            { id: "waste", label: "Waste Log", count: wasteLog.length },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => { setFinanceTab(tab.id); setFinanceSearch(""); }} className={
              "px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all " +
              (financeTab === tab.id ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700")
            }>{tab.label} <span className="text-[11px] text-zinc-400">({tab.count})</span></button>
          ))}
        </div>

        {/* Purchases Tab */}
        {financeTab === "purchases" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => { setEditingPurchase({ id: "PUR-" + Date.now(), supplierName: "", modeOfPayment: "cash", dateDelivered: new Date().toISOString().slice(0,10), particular: "", amount: 0, dueDate: "", releasedDate: "", paymentStatus: "unpaid", remarks: "" }); setShowAddPurchase(true); }} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Add Purchase</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                  <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Particular</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Due</th><th className="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-[13px]">
                  {filteredPurchases.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-zinc-400">No purchases found.</td></tr>
                  ) : filteredPurchases.map(item => (
                    <tr key={item.id} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3 text-zinc-600 text-[12px]">{item.dateDelivered}</td>
                      <td className="px-4 py-3"><div className="font-medium">{item.supplierName}</div></td>
                      <td className="px-4 py-3 text-zinc-600">{item.particular}</td>
                      <td className="px-4 py-3 text-right font-medium" style={{ fontFamily: "Fragment Mono, monospace" }}>&euro;{item.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={"inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium " + (item.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700" : item.paymentStatus === "overdue" ? "bg-red-100 text-red-700" : item.paymentStatus === "partial" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600")}>{item.paymentStatus}</span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-zinc-500">{item.dueDate || "\u2014"}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => { setEditingPurchase(item); setShowAddPurchase(true); }} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all mr-1">Edit</button>
                        <button onClick={() => { if (confirm("Delete this purchase?")) { onUpdatePurchases(prev => prev.filter(p => p.id !== item.id)); db.deletePurchase(item.id).catch(console.error); } }} className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-all">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bills & Dues Tab */}
        {financeTab === "bills" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => { setEditingBill({ id: "BILL-" + Date.now(), dueDate: "", particular: "", amount: 0, modeOfPayment: "cash", remarks: "", status: "pending", category: "utilities", branch: "" }); setShowAddBill(true); }} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Add Bill</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                  <tr><th className="px-4 py-3">Due Date</th><th className="px-4 py-3">Particular</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-[13px]">
                  {filteredBills.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-zinc-400">No bills found.</td></tr>
                  ) : filteredBills.map(item => (
                    <tr key={item.id} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3 text-[12px] text-zinc-600">{item.dueDate}</td>
                      <td className="px-4 py-3"><div className="font-medium">{item.particular}</div></td>
                      <td className="px-4 py-3"><span className="text-[12px] text-zinc-500 capitalize">{item.category.replace('_', ' ')}</span></td>
                      <td className="px-4 py-3 text-[12px] text-zinc-500">{item.branch || "\u2014"}</td>
                      <td className="px-4 py-3 text-right font-medium" style={{ fontFamily: "Fragment Mono, monospace" }}>&euro;{item.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={"inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium " + (item.status === "paid" ? "bg-emerald-100 text-emerald-700" : item.status === "overdue" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>{item.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => { setEditingBill(item); setShowAddBill(true); }} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all mr-1">Edit</button>
                        <button onClick={() => { if (confirm("Delete this bill?")) { onUpdateBillsAndDues(prev => prev.filter(b => b.id !== item.id)); db.deleteBillDue(item.id).catch(console.error); } }} className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-all">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Revenue Tab */}
        {financeTab === "revenue" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => { setEditingRevenue({ id: "REV-" + Date.now(), source: "manual", particular: "", branch: "", amount: 0, date: new Date().toISOString().slice(0,10), modeOfPayment: "cash", referenceId: "", remarks: "" }); setShowAddRevenue(true); }} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Add Revenue</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                  <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Particular</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-[13px]">
                  {filteredRevenue.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-zinc-400">No revenue entries found.</td></tr>
                  ) : filteredRevenue.map(item => (
                    <tr key={item.id} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3 text-[12px] text-zinc-600">{item.date}</td>
                      <td className="px-4 py-3"><div className="font-medium">{item.particular}</div></td>
                      <td className="px-4 py-3"><span className="text-[12px] text-zinc-500 capitalize">{item.source.replace('_', ' ')}</span></td>
                      <td className="px-4 py-3 text-[12px] text-zinc-500">{item.branch || "\u2014"}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600" style={{ fontFamily: "Fragment Mono, monospace" }}>&euro;{item.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 capitalize">{item.modeOfPayment}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => { setEditingRevenue(item); setShowAddRevenue(true); }} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all mr-1">Edit</button>
                        <button onClick={() => { if (confirm("Delete this revenue entry?")) { onUpdateRevenue(prev => prev.filter(r => r.id !== item.id)); } }} className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-all">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Waste Log Tab */}
        {financeTab === "waste" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => { setEditingWaste({ id: "WST-" + Date.now(), product: "", qtyRejected: 0, unitCost: 0, totalCost: 0, reason: "", source: "", referenceId: "", date: new Date().toISOString().slice(0,10) }); setShowAddWaste(true); }} className="rounded-xl bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">+ Log Waste</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                  <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Unit Cost</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Source</th><th className="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-[13px]">
                  {filteredWaste.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-[13px] text-zinc-400">No waste entries found.</td></tr>
                  ) : filteredWaste.map(item => (
                    <tr key={item.id} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3 text-[12px] text-zinc-600">{item.date}</td>
                      <td className="px-4 py-3"><div className="font-medium">{item.product}</div></td>
                      <td className="px-4 py-3 text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.qtyRejected}</td>
                      <td className="px-4 py-3 text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>&euro;{item.unitCost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600" style={{ fontFamily: "Fragment Mono, monospace" }}>&euro;{item.totalCost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[12px] text-zinc-500 max-w-[200px] truncate">{item.reason}</td>
                      <td className="px-4 py-3 text-[12px] text-zinc-500">{item.source}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => { setEditingWaste(item); setShowAddWaste(true); }} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 transition-all mr-1">Edit</button>
                        <button onClick={() => { if (confirm("Delete this waste entry?")) { onUpdateWasteLog(prev => prev.filter(w => w.id !== item.id)); } }} className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-all">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Purchase Modal */}
        {showAddPurchase && editingPurchase && (
          <Modal title={purchases.find(p => p.id === editingPurchase.id) ? "Edit Purchase" : "Add Purchase"} onClose={() => setShowAddPurchase(false)}>
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Supplier</label><input value={editingPurchase.supplierName} onChange={e => setEditingPurchase({...editingPurchase, supplierName: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="Supplier name" /></div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Amount</label><input type="number" value={editingPurchase.amount} onChange={e => setEditingPurchase({...editingPurchase, amount: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              </div>
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Particular</label><input value={editingPurchase.particular} onChange={e => setEditingPurchase({...editingPurchase, particular: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="What was purchased?" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Date Delivered</label><input type="date" value={editingPurchase.dateDelivered} onChange={e => setEditingPurchase({...editingPurchase, dateDelivered: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Due Date</label><input type="date" value={editingPurchase.dueDate} onChange={e => setEditingPurchase({...editingPurchase, dueDate: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Payment Mode</label>
                  <select value={editingPurchase.modeOfPayment} onChange={e => setEditingPurchase({...editingPurchase, modeOfPayment: e.target.value as any})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1">
                    <option value="cash">Cash</option><option value="online">Online</option><option value="check">Check</option>
                  </select>
                </div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Payment Status</label>
                  <select value={editingPurchase.paymentStatus} onChange={e => setEditingPurchase({...editingPurchase, paymentStatus: e.target.value as any})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1">
                    <option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Released Date</label><input type="date" value={editingPurchase.releasedDate} onChange={e => setEditingPurchase({...editingPurchase, releasedDate: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              </div>
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Remarks</label><input value={editingPurchase.remarks} onChange={e => setEditingPurchase({...editingPurchase, remarks: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowAddPurchase(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={() => { onUpdatePurchases(prev => { const idx = prev.findIndex(p => p.id === editingPurchase.id); if (idx >= 0) { const next = [...prev]; next[idx] = editingPurchase; return next; } return [...prev, editingPurchase]; }); db.upsertPurchases([editingPurchase]).catch(console.error); setShowAddPurchase(false); }} className="rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">Save</button>
              </div>
            </div>
          </Modal>
        )}

        {/* Bill Modal */}
        {showAddBill && editingBill && (
          <Modal title={billsAndDues.find(b => b.id === editingBill.id) ? "Edit Bill" : "Add Bill"} onClose={() => setShowAddBill(false)}>
            <div className="space-y-3 p-4">
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Particular</label><input value={editingBill.particular} onChange={e => setEditingBill({...editingBill, particular: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Amount</label><input type="number" value={editingBill.amount} onChange={e => setEditingBill({...editingBill, amount: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Due Date</label><input type="date" value={editingBill.dueDate} onChange={e => setEditingBill({...editingBill, dueDate: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Category</label>
                  <select value={editingBill.category} onChange={e => setEditingBill({...editingBill, category: e.target.value as any})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1">
                    <option value="utilities">Utilities</option><option value="rent">Rent</option><option value="internet">Internet</option><option value="payroll">Payroll</option><option value="maintenance">Maintenance</option><option value="supplier_dues">Supplier Dues</option><option value="miscellaneous">Miscellaneous</option>
                  </select>
                </div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Status</label>
                  <select value={editingBill.status} onChange={e => setEditingBill({...editingBill, status: e.target.value as any})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1">
                    <option value="pending">Pending</option><option value="paid">Paid</option><option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Branch</label><input value={editingBill.branch} onChange={e => setEditingBill({...editingBill, branch: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Remarks</label><input value={editingBill.remarks} onChange={e => setEditingBill({...editingBill, remarks: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowAddBill(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={() => { onUpdateBillsAndDues(prev => { const idx = prev.findIndex(b => b.id === editingBill.id); if (idx >= 0) { const next = [...prev]; next[idx] = editingBill; return next; } return [...prev, editingBill]; }); db.upsertBillsAndDues([editingBill]).catch(console.error); setShowAddBill(false); }} className="rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">Save</button>
              </div>
            </div>
          </Modal>
        )}

        {/* Revenue Modal */}
        {showAddRevenue && editingRevenue && (
          <Modal title={revenue.find(r => r.id === editingRevenue.id) ? "Edit Revenue" : "Add Revenue"} onClose={() => setShowAddRevenue(false)}>
            <div className="space-y-3 p-4">
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Particular</label><input value={editingRevenue.particular} onChange={e => setEditingRevenue({...editingRevenue, particular: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Amount</label><input type="number" value={editingRevenue.amount} onChange={e => setEditingRevenue({...editingRevenue, amount: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Date</label><input type="date" value={editingRevenue.date} onChange={e => setEditingRevenue({...editingRevenue, date: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Source</label>
                  <select value={editingRevenue.source} onChange={e => setEditingRevenue({...editingRevenue, source: e.target.value as any})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1">
                    <option value="delivery">Delivery</option><option value="manual">Manual</option><option value="branch_sales">Branch Sales</option>
                  </select>
                </div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Payment Mode</label>
                  <select value={editingRevenue.modeOfPayment} onChange={e => setEditingRevenue({...editingRevenue, modeOfPayment: e.target.value as any})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1">
                    <option value="cash">Cash</option><option value="online">Online</option><option value="check">Check</option>
                  </select>
                </div>
              </div>
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Branch</label><input value={editingRevenue.branch} onChange={e => setEditingRevenue({...editingRevenue, branch: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Remarks</label><input value={editingRevenue.remarks} onChange={e => setEditingRevenue({...editingRevenue, remarks: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowAddRevenue(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={() => { onUpdateRevenue(prev => { const idx = prev.findIndex(r => r.id === editingRevenue.id); if (idx >= 0) { const next = [...prev]; next[idx] = editingRevenue; return next; } return [...prev, editingRevenue]; }); db.upsertRevenue([editingRevenue]).catch(console.error); setShowAddRevenue(false); }} className="rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">Save</button>
              </div>
            </div>
          </Modal>
        )}

        {/* Waste Log Modal */}
        {showAddWaste && editingWaste && (
          <Modal title={wasteLog.find(w => w.id === editingWaste.id) ? "Edit Waste Entry" : "Log Waste"} onClose={() => setShowAddWaste(false)}>
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Product</label><input value={editingWaste.product} onChange={e => setEditingWaste({...editingWaste, product: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Qty Rejected</label><input type="number" value={editingWaste.qtyRejected} onChange={e => setEditingWaste({...editingWaste, qtyRejected: Number(e.target.value)})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Unit Cost</label><input type="number" value={editingWaste.unitCost} onChange={e => { const c = Number(e.target.value); setEditingWaste({...editingWaste, unitCost: c, totalCost: c * editingWaste.qtyRejected}); }} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Total Cost</label><div className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] mt-1 bg-zinc-50">&euro;{editingWaste.totalCost.toLocaleString()}</div></div>
              </div>
              <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Reason</label><input value={editingWaste.reason} onChange={e => setEditingWaste({...editingWaste, reason: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" placeholder="Why was this wasted?" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Source</label><input value={editingWaste.source} onChange={e => setEditingWaste({...editingWaste, source: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
                <div><label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Date</label><input type="date" value={editingWaste.date} onChange={e => setEditingWaste({...editingWaste, date: e.target.value})} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-zinc-400 mt-1" /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowAddWaste(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={() => { onUpdateWasteLog(prev => { const idx = prev.findIndex(w => w.id === editingWaste.id); if (idx >= 0) { const next = [...prev]; next[idx] = editingWaste; return next; } return [...prev, editingWaste]; }); db.upsertWasteLog([editingWaste]).catch(console.error); setShowAddWaste(false); }} className="rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">Save</button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  /* ── Default: Admin Dashboard ── */

  function handleExport() {
'''

new_content = content.replace(old, new, 1)

if new_content == content:
    # Try with CRLF
    old_crlf = old.replace('\n', '\r\n')
    if old_crlf in content:
        new_content = content.replace(old_crlf, new.replace('\n', '\r\n'), 1)
        if new_content != content:
            print('SUCCESS with CRLF')
        else:
            print('FAILED again')
    else:
        print('FAILED: old string not found in either format')
else:
    print('SUCCESS: finance section inserted')

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

total_lines = len(new_content.splitlines())
print(f'Total lines: {total_lines}')
