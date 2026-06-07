const fs = require('fs');

const path = 'src/components/AdminDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// We'll find the warehouse items section by finding a unique start marker and end marker
// Then replace the entire block

// Find the start marker
const startMarker = '{/* Items filtered by group */}';
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
  console.error('FAILED: Start marker not found');
  process.exit(1);
}

// Find the end marker - the next occurrence of `</>)}\n        </>)}\n` after the items block
// Actually let's find the section end: it's right before `{/* Receive Modal */}`
const receiveModalMarker = '{/* Receive Modal */}';
const endIdx = content.indexOf(receiveModalMarker, startIdx);
if (endIdx === -1) {
  console.error('FAILED: End marker not found');
  process.exit(1);
}

console.log('Found section at', startIdx, 'to', endIdx);

// Extract the old section
const oldSection = content.slice(startIdx, endIdx);
console.log('Old section length:', oldSection.length);

// Build the new section
const newSection = `{/* Items filtered by group — redesigned card layout */}
              <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-[18px] font-semibold text-zinc-900">{sidebarItems.find(s => s.key === warehouseSection)?.label}</h2>
                  <div className="flex items-center gap-2">
                    <div className="relative w-56">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
                      <input type="text" value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Search items..." className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-[13px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400" />
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-[600px] space-y-3">
                  {groupItems(warehouseSection).filter(i => (warehouseSection !== "ingredients" || ingredientRoleFilter === "all" || !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes(ingredientRoleFilter)) && (!invSearch || i.name.toLowerCase().includes(invSearch.toLowerCase()) || i.sku.toLowerCase().includes(invSearch.toLowerCase()) || i.supplier.toLowerCase().includes(invSearch.toLowerCase()))).map(item => {
                    const pct = Math.min(100, (item.onHand / item.threshold) * 100);
                    const isCritical = item.onHand < item.threshold;
                    const isExpired = item.expiryDate && item.expiryDate < todayStr;
                    const isExpiring = item.expiryDate && item.expiryDate >= todayStr && new Date(item.expiryDate).getTime() - now.getTime() <= 30 * 24 * 60 * 60 * 1000;
                    return (
                      <div key={item.id} className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-zinc-200 transition-all duration-200 odd:bg-zinc-50/30">
                        <div className="flex items-start justify-between gap-4">
                          {/* Left: Item info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h3 className="text-[15px] font-semibold text-zinc-900">{item.name}</h3>
                              <span className="text-[12px] text-zinc-400 font-mono">{item.sku}</span>
                              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">{item.category}</span>
                              {isExpired && <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700">Expired</span>}
                              {isExpiring && <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">Expiring</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                <span className="text-[13px] text-zinc-600">{item.supplier || "No supplier"}</span>
                              </div>
                              {item.expiryDate ? (
                                <div className="flex items-center gap-1.5">
                                  <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  <span className="text-[13px] text-zinc-600">Exp: {item.expiryDate}</span>
                                </div>
                              ) : (
                                <span className="text-[12px] text-zinc-400 italic">No expiry</span>
                              )}
                            </div>
                            {warehouseSection === "ingredients" && item.accessRoles && item.accessRoles.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-2.5">
                                <span className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Access:</span>
                                {item.accessRoles.map(r => (
                                  <span key={r} className={'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ' + (r === "baker" ? "bg-stone-100 text-stone-700 border border-stone-200" : r === "pastry" ? "bg-amber-50 text-amber-700 border border-amber-200" : r === "deco" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-zinc-100 text-zinc-600 border border-zinc-200")}>{r}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Right: Stock and actions */}
                          <div className="flex flex-col items-end gap-3 shrink-0">
                            {/* Stock level */}
                            <div className="text-right">
                              <div className={'text-[22px] font-bold tracking-tight ' + (isExpired ? "text-purple-500" : isCritical ? "text-red-600" : item.onHand < item.threshold * 1.5 ? "text-amber-600" : "text-emerald-600")}>
                                {item.onHand}
                                <span className="text-[14px] font-normal text-zinc-400"> / {item.threshold}</span>
                              </div>
                              <div className="text-[12px] text-zinc-500 mt-0.5">{item.unit}</div>
                            </div>
                            {/* Progress bar */}
                            <div className="w-32 h-2.5 rounded-full bg-zinc-100 overflow-hidden">
                              <div className={'h-full rounded-full transition-all duration-500 ' + (isExpired ? "bg-purple-400" : isCritical ? "bg-red-500" : item.onHand < item.threshold * 1.5 ? "bg-amber-400" : "bg-emerald-500")} style={{ width: pct + '%' }} />
                            </div>
                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <button onClick={() => setEditingInvItem(item)} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-all shadow-sm">Edit</button>
                              <button onClick={async () => { if (confirm('Delete "' + item.name + '"?')) { await db.deleteInventoryItem(item.id, item.group); onUpdateInventory(inventory.filter(i => i.id !== item.id)); onAddAuditLog?.("INVENTORY_DELETED", item.name + ' removed from ' + item.group); } }} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition-all shadow-sm">Del</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {groupItems(warehouseSection).filter(i => (warehouseSection !== "ingredients" || ingredientRoleFilter === "all" || !i.accessRoles || i.accessRoles.length === 0 || i.accessRoles.includes(ingredientRoleFilter)) && (!invSearch || i.name.toLowerCase().includes(invSearch.toLowerCase()) || i.sku.toLowerCase().includes(invSearch.toLowerCase()) || i.supplier.toLowerCase().includes(invSearch.toLowerCase()))).length === 0 && <div className="text-center py-12 text-[15px] text-zinc-400">{invSearch ? "No items match your search." : "No items in this group yet."}</div>}
                  </div>
                </div>
              </div>

        `;

// Replace
content = content.slice(0, startIdx) + newSection + content.slice(endIdx);

fs.writeFileSync(path, content, 'utf8');
console.log('SUCCESS: File written. New size:', content.length, 'chars');
