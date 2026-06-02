import re

path = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the Packaging and Deco sections inside linked recipe cards.
# They come after the `{r.ingredients.length > 0 && (` ingredients block, which ends with:
#   </div>
# </div>
# )}
#
# Then there's the packaging section, then deco section.

# The old packaging + deco sections (in linked cards specifically)
old_pack_deco = r"""                                      {/* Packaging */}
                                      {r.packaging.length > 0 && (
                                        <div className="mt-2">
                                          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Packaging</div>
                                          <div className="flex flex-wrap gap-1">
                                            {r.packaging.map((mat, i) => (
                                              <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-blue-200 px-1.5 py-0.5 text-[10px]">
                                                <span className="text-zinc-700 font-medium">{mat.name}</span>
                                                <span className="text-blue-600 font-mono">{mat.qtyPerBatch}{mat.unit}</span>
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Deco supplies */}
                                      {r.decoration.length > 0 && (
                                        <div className="mt-2">
                                          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Deco Supplies</div>
                                          <div className="flex flex-wrap gap-1">
                                            {r.decoration.map((dec, i) => (
                                              <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-purple-200 px-1.5 py-0.5 text-[10px]">
                                                <span className="text-zinc-700 font-medium">{dec.name}</span>
                                                <span className="text-purple-600 font-mono">{dec.qtyPerBatch}{dec.unit}</span>
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}"""

new_pack_deco = r"""                                      {(r.packaging.length > 0 || r.decoration.length > 0) && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                          {r.packaging.length > 0 && (
                                            <div className="rounded-xl bg-white border-2 border-blue-100 shadow-sm overflow-hidden">
                                              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-blue-50 border-b border-blue-100">
                                                <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                                                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                                                </svg>
                                                <span className="text-[12px] font-bold text-blue-700 uppercase tracking-wider">Packaging</span>
                                                <span className="ml-auto inline-flex items-center justify-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600">{r.packaging.length}</span>
                                              </div>
                                              <div className="p-3 space-y-2">
                                                {r.packaging.map((mat, i) => (
                                                  <div key={i} className="flex items-center gap-2.5 rounded-lg bg-blue-50/50 border border-blue-100/50 px-3 py-2 hover:bg-blue-50 transition-colors">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 text-[11px] font-bold">
                                                      {mat.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <div className="text-[12px] font-medium text-zinc-800 truncate">{mat.name}</div>
                                                    </div>
                                                    <div className="shrink-0 rounded-md bg-white border border-blue-200 px-2 py-1 text-[12px]">
                                                      <span className="font-medium text-blue-700">{mat.qtyPerBatch}</span>
                                                      <span className="text-blue-500 text-[10px] ml-0.5">{mat.unit}</span>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {r.decoration.length > 0 && (
                                            <div className="rounded-xl bg-white border-2 border-purple-100 shadow-sm overflow-hidden">
                                              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-purple-50 border-b border-purple-100">
                                                <svg className="w-4 h-4 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/>
                                                </svg>
                                                <span className="text-[12px] font-bold text-purple-700 uppercase tracking-wider">Deco Supplies</span>
                                                <span className="ml-auto inline-flex items-center justify-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-600">{r.decoration.length}</span>
                                              </div>
                                              <div className="p-3 space-y-2">
                                                {r.decoration.map((dec, i) => (
                                                  <div key={i} className="flex items-center gap-2.5 rounded-lg bg-purple-50/50 border border-purple-100/50 px-3 py-2 hover:bg-purple-50 transition-colors">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 text-[15px]">
                                                      ✦
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <div className="text-[12px] font-medium text-zinc-800 truncate">{dec.name}</div>
                                                    </div>
                                                    <div className="shrink-0 rounded-md bg-white border border-purple-200 px-2 py-1 text-[12px]">
                                                      <span className="font-medium text-purple-700">{dec.qtyPerBatch}</span>
                                                      <span className="text-purple-500 text-[10px] ml-0.5">{dec.unit}</span>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}"""

if old_pack_deco in content:
    content = content.replace(old_pack_deco, new_pack_deco)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Linked recipe card pack/deco sections replaced with card-within-card design.")
else:
    print("ERROR: Could not find old pack/deco section in linked cards.")
    # Let's find what's around it
    idx = content.find("{r.packaging.length > 0 && (")
    if idx >= 0:
        print(f"  Found first 'r.packaging.length > 0' at position {idx}")
        # Show context
        print(f"  Context around it:")
        print(repr(content[idx-200:idx+600]))
    else:
        print("  Could not find 'r.packaging.length > 0' anywhere")
