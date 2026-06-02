#!/usr/bin/env python3
"""Redesign the deco-queue task cards in DecoDashboard.tsx with a cleaner, professional layout."""

import re

filepath = "src/components/DecoDashboard.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace column headers (lines ~1710-1718)
old_header = '''                  {/* Column Header */}
                  <div className={`flex items-center justify-between rounded-xl ${col.bg} border ${col.border} px-4 py-3 mb-3`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                      <h3 className="text-[14px] font-semibold text-zinc-800">{col.label}</h3>
                    </div>
                    <span className={`rounded-full ${col.color} px-2 py-0.5 text-[11px] font-mono font-bold ${col.textColor}`}>
                      {col.items.length}
                    </span>
                  </div>'''

new_header = '''                  {/* Column Header */}
                  <div className="flex items-center justify-between px-4 py-3 mb-3 bg-white border border-zinc-200 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-2 w-2 rounded-full ${col.key === "pending" ? "bg-amber-500" : col.key === "in-progress" ? "bg-blue-500" : "bg-emerald-500"}`} />
                      <h3 className="text-[13px] font-semibold text-zinc-800 tracking-tight">{col.label}</h3>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600 tabular-nums">
                      {col.items.length}
                    </span>
                  </div>'''

count = content.count(old_header)
print(f"Found {count} instances of old column header")
content = content.replace(old_header, new_header, 1)

# 2. Replace card wrapper and all card content (lines ~1728-1873)
old_cards = '''                        <div
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
                                    \u2713 Completed
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-all"
                                title="Delete task"
                              >
                                <span className="text-[13px]">\u2715</span>
                              </button>
                            </div>

                            {/* Product Name + Qty */}
                            <div className="flex items-center gap-2 mb-1.5">
                              <h4 className="text-[16px] font-bold text-zinc-900 leading-tight">{task.product}</h4>
                              {task.sourceQty && task.sourceQty > 1 && (
                                <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700">\u00d7{task.sourceQty}</span>
                              )}
                            </div>

                            {/* Order Info */}
                            <div className="flex flex-wrap gap-2 mb-1">
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600 border border-rose-100">
                                \ud83c\udfa8 {task.theme}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 border border-zinc-100">
                                \ud83d\udccb {task.orderRef}
                              </span>
                              {task.sourceProducedBy && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 border border-blue-100">
                                  \ud83d\udc64 {task.sourceProducedBy}
                                </span>
                              )}
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
                                        \ud83d\udce6 Pack
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
                                        \ud83c\udfa8 Deco
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
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50/80 border-t border-zinc-100">
                            {task.status === "pending" && (
                              <button
                                onClick={() => handleForward(task)}
                                className="flex-1 rounded-lg bg-rose-500 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-rose-600 active:scale-[0.98] transition-all"
                              >
                                Start Decorating \u2192
                              </button>
                            )}
                            {task.status === "in-progress" && (
                              <>
                                <button
                                  onClick={() => handleBackward(task)}
                                  className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 active:scale-[0.98] transition-all"
                                >
                                  \u2190 Back
                                </button>
                                <button
                                  onClick={() => handleForward(task)}
                                  className="flex-1 rounded-lg bg-emerald-500 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-emerald-600 active:scale-[0.98] transition-all"
                                >
                                  \u2713 Complete
                                </button>
                              </>
                            )}
                            {task.status === "completed" && (
                              <button
                                onClick={() => handleBackward(task)}
                                className="rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 active:scale-[0.98] transition-all"
                              >
                                \u2190 Move Back
                              </button>
                            )}
                          </div>
                        </div>'''

new_cards = '''                        <div
                          key={task.id}
                          className={`rounded-xl border bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
                            task.status === "pending" ? "border-amber-200 hover:border-amber-300" : 
                            task.status === "in-progress" ? "border-blue-200 hover:border-blue-300" : 
                            "border-emerald-200 hover:border-emerald-300"
                          }`}
                        >
                          {/* Accent bar + top section */}
                          <div className="flex">
                            {/* Left accent bar */}
                            <div className={`w-1 shrink-0 ${
                              task.status === "pending" ? "bg-amber-400" : 
                              task.status === "in-progress" ? "bg-blue-400" : 
                              "bg-emerald-400"
                            }`} />
                            
                            <div className="flex-1 px-4 pt-3.5 pb-2">
                              {/* Top Row: Status Badge + Delete */}
                              <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-1.5">
                                  {task.status === "pending" && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700 border border-amber-200/60">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                      Pending
                                    </span>
                                  )}
                                  {task.status === "in-progress" && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700 border border-blue-200/60">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                      In Progress
                                    </span>
                                  )}
                                  {task.status === "completed" && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700 border border-emerald-200/60">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      Completed
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="grid h-6 w-6 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-all"
                                  title="Delete task"
                                >
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                  </svg>
                                </button>
                              </div>

                              {/* Product Name + Qty */}
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="text-[15px] font-bold text-zinc-900 leading-tight tracking-tight">{task.product}</h4>
                                {task.sourceQty && task.sourceQty > 1 && (
                                  <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">\u00d7{task.sourceQty}</span>
                                )}
                              </div>

                              {/* Metadata Grid */}
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-1">
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-rose-400 shrink-0" viewBox="0 0 16 16" fill="none">
                                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                                    <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                  </svg>
                                  <span className="text-[11px] text-zinc-600 font-medium">{task.theme}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" viewBox="0 0 16 16" fill="none">
                                    <rect x="2" y="3.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                                    <path d="M5 2v3M11 2v3M2 6.5h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                  </svg>
                                  <span className="text-[11px] text-zinc-500 font-mono">{task.orderRef}</span>
                                </div>
                                {task.sourceProducedBy && (
                                  <div className="flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" viewBox="0 0 16 16" fill="none">
                                      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
                                      <path d="M2 14c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                    </svg>
                                    <span className="text-[11px] text-zinc-600 font-medium capitalize">{task.sourceProducedBy}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Notes */}
                          {task.notes && (
                            <div className="px-4 pb-2">
                              <div className="flex items-start gap-2 rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">
                                <svg className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" viewBox="0 0 16 16" fill="none">
                                  <path d="M8 3v7M8 12v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                                <p className="text-[11px] text-zinc-500 leading-relaxed">{task.notes}</p>
                              </div>
                            </div>
                          )}

                          {/* Materials Required (Pending & In Progress) */}
                          {(task.status === "pending" || task.status === "in-progress") && (() => {
                            const recipe = recipes.find(r => r.productName === task.product);
                            if (!recipe || (recipe.packaging.length === 0 && recipe.decoration.length === 0)) return null;
                            return (
                              <div className="px-4 pb-3">
                                <div className="rounded-lg border border-zinc-100 overflow-hidden">
                                  <div className="bg-zinc-50/80 px-3 py-1.5 border-b border-zinc-100">
                                    <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">Materials Required</span>
                                  </div>
                                  <div className="p-2.5 space-y-2">
                                    {recipe.packaging.length > 0 && (
                                      <div>
                                        <span className="inline-flex items-center gap-1.5 mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-blue-600">
                                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none">
                                            <rect x="2" y="5.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                                            <path d="M4 2.5h8M6 1h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                          </svg>
                                          Packaging
                                        </span>
                                        <div className="flex flex-wrap gap-1.5">
                                          {recipe.packaging.map((p, i) => (
                                            <span key={i} className="inline-flex items-center gap-1.5 bg-white border border-blue-200/60 rounded-md px-2 py-1 text-[10px]">
                                              <span className="text-zinc-700 font-medium">{p.name}</span>
                                              <span className="text-blue-600 font-semibold tabular-nums">{Math.ceil(p.qtyPerBatch * (task.sourceQty || 1))}{p.unit}</span>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {recipe.decoration.length > 0 && (
                                      <div>
                                        <span className="inline-flex items-center gap-1.5 mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-purple-600">
                                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none">
                                            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                                            <path d="M8 3v2M8 11v2M3 8h2M11 8h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                          </svg>
                                          Decoration
                                        </span>
                                        <div className="flex flex-wrap gap-1.5">
                                          {recipe.decoration.map((d, i) => (
                                            <span key={i} className="inline-flex items-center gap-1.5 bg-white border border-purple-200/60 rounded-md px-2 py-1 text-[10px]">
                                              <span className="text-zinc-700 font-medium">{d.name}</span>
                                              <span className="text-purple-600 font-semibold tabular-nums">{Math.ceil(d.qtyPerBatch * (task.sourceQty || 1))}{d.unit}</span>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Actions */}
                          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-zinc-100 bg-zinc-50/60">
                            {task.status === "pending" && (
                              <button
                                onClick={() => handleForward(task)}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-500 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-rose-600 active:scale-[0.98] transition-all"
                              >
                                Start Decorating
                                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            )}
                            {task.status === "in-progress" && (
                              <>
                                <button
                                  onClick={() => handleBackward(task)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.98] transition-all"
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                                    <path d="M10 12l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                  Back
                                </button>
                                <button
                                  onClick={() => handleForward(task)}
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-600 active:scale-[0.98] transition-all"
                                >
                                  Complete
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                                    <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              </>
                            )}
                            {task.status === "completed" && (
                              <button
                                onClick={() => handleBackward(task)}
                                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.98] transition-all"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                                  <path d="M10 12l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Move Back
                              </button>
                            )}
                          </div>
                        </div>'''

count_cards = content.count(old_cards)
print(f"Found {count_cards} instances of old cards block")

if count_cards == 1 and count == 1:
    content = content.replace(old_cards, new_cards, 1)
    content = content.replace(old_header, new_header, 1)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Successfully replaced column header and cards block!")
else:
    print(f"Count mismatch. Header: {count}, Cards: {count_cards}")
    print("Trying alternative approach...")
    # Try finding just the cards block first
    content2 = content
    if count_cards == 1:
        content2 = content2.replace(old_cards, new_cards, 1)
    if count == 1:
        content2 = content2.replace(old_header, new_header, 1)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content2)
    print("Saved with partial replacements.")
