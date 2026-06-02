import re

with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add expandedProdHistory state after showAllProdHistory
old_state = '  const [showAllProdHistory, setShowAllProdHistory] = useState(false);\n  const toggleDOSHistory'
new_state = '  const [showAllProdHistory, setShowAllProdHistory] = useState(false);\n  const [expandedProdHistory, setExpandedProdHistory] = useState<Set<string>>(new Set());\n  const toggleProdHistory = (date: string) => setExpandedProdHistory(prev => { const n = new Set(prev); if (n.has(date)) n.delete(date); else n.add(date); return n; });\n  const toggleDOSHistory'

if old_state in text:
    text = text.replace(old_state, new_state, 1)
    print("Added expandedProdHistory state")
else:
    # Try with CRLF
    old_state_crlf = old_state.replace('\n', '\r\n')
    new_state_crlf = new_state.replace('\n', '\r\n')
    if old_state_crlf in text:
        text = text.replace(old_state_crlf, new_state_crlf, 1)
        print("Added expandedProdHistory state (CRLF)")
    else:
        print("ERROR: Could not find showAllProdHistory state position")
        exit(1)

# 2. Replace the day group rendering in Production History
# Find the pattern from `{displayed.map(group => (` up to `))}{!showAllProdHistory`
old_day_group = '''                {displayed.map(group => (
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
                )}'''

new_day_group = '''                {displayed.map(group => {
                  const isExpanded = expandedProdHistory.has(group.date);
                  return (
                    <div key={group.date} className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
                      <button onClick={() => toggleProdHistory(group.date)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors text-left cursor-pointer">
                        <div className="flex items-center gap-3">
                          <span className="text-[14px] font-medium text-zinc-900">
                            {new Date(group.date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 font-mono">{group.items.length} task{group.items.length > 1 ? "s" : ""} \u2022 {group.total} pcs</span>
                          <span className="text-[11px] text-zinc-500">{group.done}/{group.items.length} done</span>
                        </div>
                        <span className="text-zinc-400 text-[13px]">{isExpanded ? "\u25be" : "\u25b8"}</span>
                      </button>
                      {isExpanded && (
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
                      )}
                    </div>
                  );
                })}
                {!showAllProdHistory && prodGroups.length > 3 && (
                  <button onClick={() => setShowAllProdHistory(true)} className="w-full rounded-xl border border-dashed border-zinc-200 py-2.5 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-all">
                    See all ({prodGroups.length} day{prodGroups.length > 1 ? "s" : ""})
                  </button>
                )}
                {showAllProdHistory && prodGroups.length > 3 && (
                  <button onClick={() => setShowAllProdHistory(false)} className="w-full rounded-xl border border-dashed border-zinc-200 py-2.5 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-all">
                    Show less
                  </button>
                )}'''

if old_day_group in text:
    text = text.replace(old_day_group, new_day_group, 1)
    print("Replaced day group with expandable version")
else:
    # Try with CRLF
    old_day_group_crlf = old_day_group.replace('\n', '\r\n')
    new_day_group_crlf = new_day_group.replace('\n', '\r\n')
    if old_day_group_crlf in text:
        text = text.replace(old_day_group_crlf, new_day_group_crlf, 1)
        print("Replaced day group with expandable version (CRLF)")
    else:
        print("ERROR: Could not find day group pattern")
        # Debug: find partial matches
        idx = text.find('{displayed.map(group =>')
        if idx >= 0:
            print(f"Found start at {idx}: {repr(text[idx:idx+80])}")
        else:
            print("Could not find even the start of the pattern")
        exit(1)

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
print("File saved successfully")
