import re

with open('src/components/DecoDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the old card block - search for unique markers
old_start = 'rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-all hover:border-zinc-300'
old_end = '                          </div>'

# Find the start position
start_idx = content.find(old_start)
if start_idx < 0:
    print('ERROR: start marker not found')
    exit(1)

# Find the matching closing div (need to find the right one)
# Search backwards from where we know the actions block ends
# The old card ends with the closing div of the outer card div
# Let's find a unique marker near the end
end_marker = '<span className="text-[13px]">🗑️</span>'
end_idx = content.find(end_marker, start_idx)
if end_idx < 0:
    print('ERROR: end marker not found')
    exit(1)

# The closing divs after the delete button
# ...</button>\n                          </div>\n                        </div>
# The closing </div> after the delete button row, then the card div
close_pattern = '</button>\n                          </div>'
close_start = content.find(close_pattern, end_idx)
if close_start < 0:
    print('ERROR: close pattern not found')
    exit(1)

# Find the next </div> after that (the card's closing div)
card_close = content.find('</div>', close_start + len(close_pattern))
# The card close is the </div> at the closing of the outer card div
# Let me find the exact close: it should be </div> on its own line at the right indentation
# After '</button>\n                          </div>' there's one more '</div>' to close the card
# But wait, there might be multiple. Let me look for it more carefully
rest = content[close_start + len(close_pattern):]
# The rest should start with '\n                        </div>'
rest_stripped = rest.lstrip('\n')
if rest_stripped.startswith('                        </div>'):
    close_actual = close_start + len(close_pattern) + (len(rest) - len(rest_stripped))
    card_close_idx = close_actual + len('                        </div>')
    
    old_card = content[start_idx - 24:card_close_idx]  # include the leading whitespace div(
else:
    print('ERROR: could not find card closing div')
    print('Rest:', repr(rest[:200]))
    exit(1)

print(f'Old card found: {start_idx - 24} to {card_close_idx}')

new_card = r'''                        <div
                          key={task.id}
                          className="rounded-xl border border-zinc-200 bg-white shadow-sm hover:shadow-lg transition-all duration-200 hover:border-zinc-300 overflow-hidden"
                        >
                          {/* Status Color Bar */}
                          <div className={`px-4 py-0.5 ${task.status === "pending" ? "bg-amber-400" : task.status === "in-progress" ? "bg-blue-400" : "bg-emerald-400"}`} />
                          <div className="px-4 pt-3 pb-2">
                            {/* Top Row: Status Badge + Delete */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                {task.status === "pending" && (
                                  <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 border border-amber-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    Pending
                                  </span>
                                )}
                                {task.status === "in-progress" && (
                                  <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 border border-blue-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    In Progress
                                  </span>
                                )}
                                {task.status === "completed" && (
                                  <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    ✓ Completed
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-all"
                                title="Delete task"
                              >
                                <span className="text-[13px]">✕</span>
                              </button>
                            </div>

                            {/* Product Name + Qty */}
                            <div className="flex items-center gap-2 mb-1.5">
                              <h4 className="text-[16px] font-bold text-zinc-900 leading-tight">{task.product}</h4>
                              {task.sourceQty && task.sourceQty > 1 && (
                                <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700">×{task.sourceQty}</span>
                              )}
                            </div>

                            {/* Order Info */}
                            <div className="flex flex-wrap gap-2 mb-1">
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600 border border-rose-100">
                                🎨 {task.theme}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 border border-zinc-100">
                                📋 {task.orderRef}
                              </span>
                              {task.sourceProducedBy && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 border border-blue-100">
                                  👤 {task.sourceProducedBy}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Notes */}
                          {task.notes && (
                            <div className="mx-4 mb-2">
                              <p className="text-[12px] text-zinc-500 leading-relaxed bg-zinc-50 rounded-lg px-3 py-2 border border-zinc-100 italic">
                                {task.notes}
                              </p>
                            </div>
                          )}

                          {/* Pack & Deco Info (Pending & In Progress) */}
                          {(task.status === "pending" || task.status === "in-progress") && (() => {
                            const recipe = recipes.find(r => r.productName === task.product);
                            if (!recipe || (recipe.packaging.length === 0 && recipe.decoration.length === 0)) return null;
                            return (
                              <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-gradient-to-r from-zinc-50 to-white border border-zinc-100">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Materials Required</div>
                                <div className="flex flex-wrap gap-2">
                                  {recipe.packaging.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-700">
                                        📦 Pack
                                      </span>
                                      {recipe.packaging.map((p, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-blue-200 px-1.5 py-0.5 text-[10px]">
                                          <span className="text-zinc-700 font-medium">{p.name}</span>
                                          <span className="text-blue-600 font-mono">{Math.ceil(p.qtyPerBatch * (task.sourceQty || 1))}{p.unit}</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {recipe.decoration.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-700">
                                        🎨 Deco
                                      </span>
                                      {recipe.decoration.map((d, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-purple-200 px-1.5 py-0.5 text-[10px]">
                                          <span className="text-zinc-700 font-medium">{d.name}</span>
                                          <span className="text-purple-600 font-mono">{Math.ceil(d.qtyPerBatch * (task.sourceQty || 1))}{d.unit}</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Actions */}
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50/80 border-t border-zinc-100">
                            {task.status === "pending" && (
                              <button
                                onClick={() => handleForward(task)}
                                className="flex-1 rounded-lg bg-rose-500 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-rose-600 active:scale-[0.98] transition-all"
                              >
                                Start Decorating →
                              </button>
                            )}
                            {task.status === "in-progress" && (
                              <>
                                <button
                                  onClick={() => handleBackward(task)}
                                  className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 active:scale-[0.98] transition-all"
                                >
                                  ← Back
                                </button>
                                <button
                                  onClick={() => handleForward(task)}
                                  className="flex-1 rounded-lg bg-emerald-500 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-emerald-600 active:scale-[0.98] transition-all"
                                >
                                  ✓ Complete
                                </button>
                              </>
                            )}
                            {task.status === "completed" && (
                              <button
                                onClick={() => handleBackward(task)}
                                className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 active:scale-[0.98] transition-all"
                              >
                                ← Move Back
                              </button>
                            )}
                          </div>'''

content = content[:start_idx - 24] + new_card + content[card_close_idx:]
print(f'Replaced old card ({card_close_idx - start_idx + 24} chars) with new card ({len(new_card)} chars)')

with open('src/components/DecoDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('File written successfully')
