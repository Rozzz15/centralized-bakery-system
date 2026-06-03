import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the analytics IIFE block
marker = 'financeTab === "analytics" && (() => {'
ana_start = content.find(marker)
if ana_start < 0:
    print("ERROR: Analytics block not found!")
    exit(1)

# Find the end - look for })()} followed by analytics or next tab
ana_end_marker = '        })()}\n'
ana_end = content.find(ana_end_marker, ana_start)
if ana_end < 0:
    ana_end_marker = '        })()}\r\n'
    ana_end = content.find(ana_end_marker, ana_start)

if ana_end < 0:
    print("ERROR: Analytics block end not found!")
    # Try to find via brace counting
    depth = 0
    in_str = False
    str_c = None
    i = ana_start
    while i < len(content):
        c = content[i]
        if in_str:
            if c == '\\':
                i += 2
                continue
            if c == str_c:
                in_str = False
        else:
            if c in '"\'':
                in_str = True
                str_c = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    # This closes the outer { of the expression
                    pass
        i += 1
    print("Brace counting approach didn't work either")
    exit(1)

ana_end += len(ana_end_marker)

# Build the new clean analytics block
# The new design focuses on CHARTS with a minimal stat header
# No redundant KPIs (those are already in the summary section above)
new_block = '''financeTab === "analytics" && (() => {
          const purchaseData = [...filteredPurchases];
          const billData = [...filteredBills];
          const revenueData = [...filteredRevenue];
          const wasteData = [...filteredWaste];

          const totalRev = revenueData.reduce((s, r) => s + r.amount, 0);
          const totalPur = purchaseData.reduce((s, p) => s + p.amount, 0);
          const totalBill = billData.reduce((s, b) => s + b.amount, 0);
          const totalWaste = wasteData.reduce((s, w) => s + w.totalCost, 0);
          const netIncome = totalRev - totalPur - totalBill - totalWaste;
          const avgDailyRev = revenueData.length > 0 ? totalRev / Math.max(1, new Set(revenueData.map(r => r.date)).size) : 0;
          const topRevenueSource = revenueData.length > 0 ? Object.entries(revenueData.reduce((acc, r) => ({ ...acc, [r.source]: (acc[r.source] || 0) + r.amount }), {} as Record<string, number>)).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A" : "N/A";
          const unpaidPurchasesAmt = purchaseData.filter(p => p.paymentStatus === "unpaid" || p.paymentStatus === "overdue").reduce((s, p) => s + p.amount, 0);
          const pendingBillsAmt = billData.filter(b => b.status === "pending" || b.status === "overdue").reduce((s, b) => s + b.amount, 0);

          // Aggregate revenue by date
          const byDate = revenueData.reduce((acc, r) => { const d = r.date; if (!acc[d]) acc[d] = 0; acc[d] += r.amount; return acc; }, {} as Record<string, number>);
          const revenueByDate = Object.entries(byDate).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));

          // Aggregate by source
          const bySource = revenueData.reduce((acc, r) => { if (!acc[r.source]) acc[r.source] = 0; acc[r.source] += r.amount; return acc; }, {} as Record<string, number>);
          const sourceData = Object.entries(bySource).map(([source, amount]) => ({ source, amount })).sort((a, b) => b.amount - a.amount);

          // Aggregate purchases by supplier
          const bySupplier = purchaseData.reduce((acc, p) => { if (!acc[p.supplierName]) acc[p.supplierName] = 0; acc[p.supplierName] += p.amount; return acc; }, {} as Record<string, number>);
          const supplierData = Object.entries(bySupplier).map(([supplier, amount]) => ({ supplier, amount })).sort((a, b) => b.amount - a.amount).slice(0, 8);

          // Aggregate bills by category
          const byBillCategory = billData.reduce((acc, b) => { const cat = b.category || "Uncategorized"; if (!acc[cat]) acc[cat] = 0; acc[cat] += b.amount; return acc; }, {} as Record<string, number>);
          const billCategoryData = Object.entries(byBillCategory).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);

          // Aggregate bills by status
          const byBillStatus = billData.reduce((acc, b) => { const st = b.status || "unknown"; if (!acc[st]) acc[st] = 0; acc[st] += b.amount; return acc; }, {} as Record<string, number>);
          const billStatusData = Object.entries(byBillStatus).map(([status, amount]) => ({ status, amount })).sort((a, b) => b.amount - a.amount);

          // Aggregate waste by reason
          const byWasteReason = wasteData.reduce((acc, w) => { if (!acc[w.reason]) acc[w.reason] = 0; acc[w.reason] += w.totalCost; return acc; }, {} as Record<string, number>);
          const wasteReasonData = Object.entries(byWasteReason).map(([reason, amount]) => ({ reason, amount })).sort((a, b) => b.amount - a.amount);

          // Aggregate waste by product
          const byWasteProduct = wasteData.reduce((acc, w) => { if (!acc[w.product]) acc[w.product] = 0; acc[w.product] += w.totalCost; return acc; }, {} as Record<string, number>);
          const wasteProductData = Object.entries(byWasteProduct).map(([product, amount]) => ({ product, amount })).sort((a, b) => b.amount - a.amount).slice(0, 6);

          // Aggregate revenue by particular
          const byParticular = revenueData.reduce((acc, r) => { const p = r.particular || "Unspecified"; if (!acc[p]) acc[p] = 0; acc[p] += r.amount; return acc; }, {} as Record<string, number>);
          const particularData = Object.entries(byParticular).map(([product, amount]) => ({ product, amount })).sort((a, b) => b.amount - a.amount).slice(0, 8);

          // Aggregate purchases by particular
          const byPurParticular = purchaseData.reduce((acc, p) => { const pt = p.particular || "Unspecified"; if (!acc[pt]) acc[pt] = 0; acc[pt] += p.amount; return acc; }, {} as Record<string, number>);
          const purParticularData = Object.entries(byPurParticular).map(([product, amount]) => ({ product, amount })).sort((a, b) => b.amount - a.amount).slice(0, 8);

          const PIE_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#84cc16', '#06b6d4'];
          const formatPHP = (n: number) => "\u20b1" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const activeDays = new Set(revenueData.map(r => r.date)).size;

          return (
            <div className="space-y-6">
              {/* Quick Stats Bar - only shows insights NOT in summary above */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700 text-[14px] font-bold">\u20b1</div>
                    <div>
                      <div className="text-[11px] font-medium text-zinc-500">Net Income</div>
                      <div className={"text-[16px] font-bold " + (netIncome >= 0 ? "text-emerald-700" : "text-red-700")}>{formatPHP(netIncome)}</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-amber-700 text-[14px] font-bold">\u2191</div>
                    <div>
                      <div className="text-[11px] font-medium text-zinc-500">Top Source</div>
                      <div className="text-[16px] font-bold text-zinc-800 truncate" title={topRevenueSource}>{topRevenueSource}</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-100 text-blue-700 text-[14px] font-bold">\u2302</div>
                    <div>
                      <div className="text-[11px] font-medium text-zinc-500">Avg. Daily</div>
                      <div className="text-[16px] font-bold text-zinc-800">{formatPHP(avgDailyRev)}</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-100 text-zinc-700 text-[14px] font-bold">#</div>
                    <div>
                      <div className="text-[11px] font-medium text-zinc-500">Active Days</div>
                      <div className="text-[16px] font-bold text-zinc-800">{activeDays} day{activeDays !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Revenue Analysis */}
              <div>
                <h3 className="text-[13px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Revenue Analysis</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Revenue Trends - Line Chart */}
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm lg:col-span-2">
                    <h4 className="mb-3 text-[13px] font-semibold text-zinc-800">Revenue Trends</h4>
                    {revenueByDate.length > 0 ? (
                      <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={revenueByDate}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" fontSize={9} tickFormatter={v => { const d = new Date(v + "T00:00:00"); return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" }); }} />
                            <YAxis fontSize={9} tickFormatter={v => "\u20b1" + (v >= 1000 ? (v/1000).toFixed(1) + "k" : v)} />
                            <Tooltip formatter={(value: any) => [formatPHP(value), "Revenue"]} labelFormatter={v => { const d = new Date(v + "T00:00:00"); return d.toLocaleDateString("en-PH", { weekday: "short", month: "long", day: "numeric", year: "numeric" }); }} />
                            <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={{ r: 2, fill: "#10b981" }} activeDot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex h-[220px] items-center justify-center text-[12px] text-zinc-400">No revenue data for this period.</div>
                    )}
                  </div>

                  {/* Revenue by Source - Pie Chart */}
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <h4 className="mb-3 text-[13px] font-semibold text-zinc-800">Revenue by Source</h4>
                    {sourceData.length > 0 ? (
                      <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={sourceData} dataKey="amount" nameKey="source" cx="50%" cy="50%" outerRadius={65} label={({ name, percent = 0 }) => `${(percent * 100).toFixed(0)}%`}>
                              {sourceData.map((_, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(value: any) => [formatPHP(value), "Amount"]} />
                            <Legend fontSize={8} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex h-[220px] items-center justify-center text-[12px] text-zinc-400">No data</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section: Expense Analysis */}
              {(supplierData.length > 0 || billCategoryData.length > 0 || billStatusData.length > 0) && (
              <div>
                <h3 className="text-[13px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Expense Analysis</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {supplierData.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <h4 className="mb-3 text-[13px] font-semibold text-zinc-800">Top Suppliers</h4>
                    <div className="space-y-2">
                      {supplierData.slice(0, 6).map((item, i) => (
                        <div key={item.supplier} className="flex items-center gap-2">
                          <span className="w-4 text-[10px] font-mono text-zinc-400 text-right">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-zinc-700 truncate">{item.supplier}</span>
                              <span className="text-[10px] font-medium text-zinc-500 shrink-0 ml-2">{formatPHP(item.amount)}</span>
                            </div>
                            <div className="h-1 rounded-full bg-zinc-100 mt-1 overflow-hidden">
                              <div className="h-full rounded-full bg-orange-400" style={{ width: Math.max(3, (item.amount / supplierData[0].amount) * 100) + "%" }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}

                  {billCategoryData.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <h4 className="mb-3 text-[13px] font-semibold text-zinc-800">Bills by Category</h4>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={billCategoryData} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={60} label={({ name, percent = 0 }) => `${(percent * 100).toFixed(0)}%`}>
                            {billCategoryData.map((_, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[(index + 3) % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(value: any) => [formatPHP(value), "Amount"]} />
                          <Legend fontSize={8} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  )}

                  {billStatusData.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <h4 className="mb-3 text-[13px] font-semibold text-zinc-800">Bills by Status</h4>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={billStatusData} dataKey="amount" nameKey="status" cx="50%" cy="50%" outerRadius={60} label={({ name, percent = 0 }) => `${(percent * 100).toFixed(0)}%`}>
                            {billStatusData.map((_, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[(index + 6) % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(value: any) => [formatPHP(value), "Amount"]} />
                          <Legend fontSize={8} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  )}
                </div>
              </div>
              )}

              {/* Section: Top Items */}
              <div>
                <h3 className="text-[13px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Top Items</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {particularData.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <h4 className="mb-3 text-[13px] font-semibold text-zinc-800">Revenue</h4>
                    <div className="space-y-2">
                      {particularData.slice(0, 6).map((item, i) => (
                        <div key={item.product} className="flex items-center gap-2">
                          <span className="w-4 text-[10px] font-mono text-zinc-400 text-right">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-zinc-700 truncate">{item.product}</span>
                              <span className="text-[10px] font-medium text-zinc-500 shrink-0 ml-2">{formatPHP(item.amount)}</span>
                            </div>
                            <div className="h-1 rounded-full bg-zinc-100 mt-1 overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-400" style={{ width: Math.max(3, (item.amount / particularData[0].amount) * 100) + "%" }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}

                  {purParticularData.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <h4 className="mb-3 text-[13px] font-semibold text-zinc-800">Purchases</h4>
                    <div className="space-y-2">
                      {purParticularData.slice(0, 6).map((item, i) => (
                        <div key={item.product} className="flex items-center gap-2">
                          <span className="w-4 text-[10px] font-mono text-zinc-400 text-right">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-zinc-700 truncate">{item.product}</span>
                              <span className="text-[10px] font-medium text-zinc-500 shrink-0 ml-2">{formatPHP(item.amount)}</span>
                            </div>
                            <div className="h-1 rounded-full bg-zinc-100 mt-1 overflow-hidden">
                              <div className="h-full rounded-full bg-red-400" style={{ width: Math.max(3, (item.amount / purParticularData[0].amount) * 100) + "%" }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}

                  {wasteProductData.length > 0 && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <h4 className="mb-3 text-[13px] font-semibold text-zinc-800">Waste</h4>
                    <div className="space-y-2">
                      {wasteProductData.slice(0, 6).map((item, i) => (
                        <div key={item.product} className="flex items-center gap-2">
                          <span className="w-4 text-[10px] font-mono text-zinc-400 text-right">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-zinc-700 truncate">{item.product}</span>
                              <span className="text-[10px] font-medium text-zinc-500 shrink-0 ml-2">{formatPHP(item.amount)}</span>
                            </div>
                            <div className="h-1 rounded-full bg-zinc-100 mt-1 overflow-hidden">
                              <div className="h-full rounded-full bg-purple-400" style={{ width: Math.max(3, (item.amount / wasteProductData[0].amount) * 100) + "%" }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}'''

# Replace the old block with the new one
old_start = content.find(marker)
if old_start < 0:
    print("ERROR: Could not find marker!")
    exit(1)

old_end = ana_end  # end of the block including })()}
old_block = content[old_start:old_end]

if old_block in content:
    content = content.replace(old_block, new_block, 1)
    print("OK - Replaced analytics block")
else:
    # Try with rn
    old_block_rn = old_block.replace('\n', '\r\n')
    new_block_rn = new_block.replace('\n', '\r\n')
    if old_block_rn in content:
        content = content.replace(old_block_rn, new_block_rn, 1)
        print("OK - Replaced analytics block (rn)")
    else:
        print("ERROR: Could not match old block!")
        print(repr(old_block[:100]))

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! Analytics tab cleaned and professionalized.")
