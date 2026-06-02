with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# Find the end of the Pending Authorization section and insert Production History before the main wrapper closing div
# The structure is:
#   ...
#         )}
#       </div>
#     );
#   }
#
# We want to insert after the ")}" that closes the Pending Authorization conditional

anchor = '        {(pendingBaker.length > 0 || pendingDeco.length > 0) && ('
idx = c.find(anchor)
if idx < 0:
    print("ERROR: Could not find Pending Authorization anchor")
    exit(1)

# Find the closing ")}" of this conditional block
# The pattern is: the section ends with:
#               ))}
#             </div>
#           </div>
#         )}       <-- this closes the (pendingBaker... && ( ... )
#       </div>     <-- this is the main wrapper div

# Let's find Authorize first
auth_idx = c.find("Authorize</button>", idx)
if auth_idx < 0:
    print("ERROR: Could not find Authorize</button>")
    exit(1)

# After Authorize</button>, find the closing pattern:
# We need ")}" followed by whitespace and then "</div>"
# Let's find the second ")}" after the pending section content

pending_end = c.find("\n        )}\n      </div>\n    );\n  }\n\n  /* \u2500\u2500 Deliveries Tab", idx)
if pending_end < 0:
    # Try alternate pattern
    pending_end = c.find("        )}\n      </div>\n    );\n  }\n\n  /* \u2500\u2500", idx)

if pending_end < 0:
    # Try different approach: find the end of the production tab return
    prod_tab_start = c.find("/* \u2500\u2500 Production Tab (Enhanced) \u2500\u2500 */")
    if prod_tab_start < 0:
        prod_tab_start = c.find("/* -- Production Tab (Enhanced) -- */")
    
    if prod_tab_start >= 0:
        # Find from here to the next tab comment
        next_tab = c.find("/* \u2500\u2500 Deliveries Tab", prod_tab_start + 50)
        if next_tab < 0:
            next_tab = c.find("/* -- Deliveries Tab", prod_tab_start + 50)
        
        if next_tab >= 0:
            # Work backwards from the next tab to find the production tab's closing
            # Look for ")}\n      </div>\n    );\n  }"
            search_area = c[prod_tab_start:next_tab]
            # Find the last occurrence of the closing pattern
            # Pattern: after the pending auth section's closing
            markers = ["Authorize</button>", "Authorize"]
            for marker in markers:
                last_marker = search_area.rfind(marker)
                if last_marker >= 0:
                    # After the last marker, find ")}\n      </div>"
                    after_marker = search_area[last_marker:]
                    close_paren = after_marker.find("        )}")
                    if close_paren >= 0:
                        pending_end = prod_tab_start + last_marker + close_paren
                        break

if pending_end < 0:
    print("ERROR: Could not find the insertion point")
    exit(1)

# Insert at pending_end (which is at the "        )}" closing the pending auth conditional)
# We add a newline after the ")}" and then add the Production History section
# Then the rest "      </div>\n    );\n  }" follows

prod_history = '''
        {/* Production History */}
        {(() => {
          const todayStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
          const prodGroups = (() => {
            const groups = new Map<string, ProductionTask[]>();
            production.forEach(task => {
              const ts = task.id.match(/PRD-(\\d+)/)?.[1];
              if (!ts) return;
              const dateKey = new Date(Number(ts)).toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
              if (dateKey === todayStr) return;
              if (!groups.has(dateKey)) groups.set(dateKey, []);
              groups.get(dateKey)!.push(task);
            });
            return Array.from(groups.entries())
              .map(([date, items]) => ({ date, items, total: items.reduce((s, i) => s + i.target, 0), done: items.filter(i => i.status === "completed").length }))
              .sort((a, b) => b.date.localeCompare(a.date));
          })();

          if (prodGroups.length === 0) return null;

          const displayed = showAllProdHistory ? prodGroups : prodGroups.slice(0, 3);

          return (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[18px] font-semibold">Production History</h2>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 font-mono">{prodGroups.length} day{prodGroups.length > 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-2">
                {displayed.map(group => (
                  <div key={group.date} className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
                    <div className="flex items-center justify-between px-4 py-3 bg-zinc-50/60">
                      <div className="flex items-center gap-3">
                        <span className="text-[14px] font-medium text-zinc-900">
                          {new Date(group.date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 font-mono">{group.items.length} task{group.items.length > 1 ? "s" : ""} \u2022 {group.total} pcs</span>
                        <span className="text-[11px] text-zinc-500">{group.done}/{group.items.length} done</span>
                      </div>
                    </div>
                    <div className="border-t border-zinc-100">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                          <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
                            <tr><th className="px-4 py-2.5">Product</th><th className="px-4 py-2.5 text-right">Target</th><th className="px-4 py-2.5 text-right">Completed</th><th className="px-4 py-2.5">Assigned To</th><th className="px-4 py-2.5 text-right">Status</th></tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {group.items.map(task => (
                              <tr key={task.id} className="hover:bg-amber-50/40">
                                <td className="px-4 py-2 font-medium text-zinc-900">{task.product}</td>
                                <td className="px-4 py-2 text-right font-mono text-zinc-600">{task.target}</td>
                                <td className="px-4 py-2 text-right font-mono text-zinc-600">{task.completed}</td>
                                <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${task.assignedTo === "baker" ? "bg-stone-500" : task.assignedTo === "deco" ? "bg-rose-500" : task.assignedTo === "kitchen" ? "bg-emerald-500" : "bg-zinc-400"}`}>{task.assignedTo || "\u2014"}</span></td>
                                <td className="px-4 py-2 text-right"><span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${task.status === "completed" ? "text-emerald-700" : task.status === "in-progress" ? "text-amber-700" : "text-zinc-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${task.status === "completed" ? "bg-emerald-500" : task.status === "in-progress" ? "bg-amber-500" : "bg-zinc-300"}`} />{task.status === "in-progress" ? "In Progress" : task.status === "completed" ? "Completed" : "Pending"}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
                {!showAllProdHistory && prodGroups.length > 3 && (
                  <button onClick={() => setShowAllProdHistory(true)} className="w-full rounded-xl border border-dashed border-zinc-200 py-2.5 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-all">
                    See all ({prodGroups.length} day{prodGroups.length > 1 ? "s" : ""})
                  </button>
                )}
                {showAllProdHistory && prodGroups.length > 3 && (
                  <button onClick={() => setShowAllProdHistory(false)} className="w-full rounded-xl border border-dashed border-zinc-200 py-2.5 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-all">
                    Show less
                  </button>
                )}
              </div>
            </div>
          );
        })()}
'''

# Insert the production history after the pending auth's closing "    )}"
# The "    )}" has a newline after it
insert_pos = pending_end + len("        )}")
c = c[:insert_pos] + prod_history + c[insert_pos:]

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(c)
print("Production History section added successfully")
print(f"File size: {len(c)} chars")
