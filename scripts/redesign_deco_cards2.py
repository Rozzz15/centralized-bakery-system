#!/usr/bin/env python3
"""Redesign the deco-queue task cards in DecoDashboard.tsx using line ranges."""

import sys

filepath = "src/components/DecoDashboard.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

# Find the relevant sections by matching patterns
# Column header start
header_start = None
for i, line in enumerate(lines):
    if '{/* Column Header */}' in line and 'rounded-xl' in lines[i+1] if i+1 < len(lines) else False:
        header_start = i
        break

# Cards section start (card wrapper)
card_start = None
for i, line in enumerate(lines):
    if 'rounded-xl border border-zinc-200 bg-white shadow-sm hover:shadow-lg' in line:
        card_start = i
        break

# Find where the card section ends by tracking nesting
# The card starts at line card_start and the wrapper ends at the next `                        </div>` at the same level
card_end = None
if card_start is not None:
    # Look for the closing of this specific card rendering section
    # It ends where we see `                      ))}` (closing of col.items.map) then `                    )}` then `                  </div>` then `                </div>` then `              ))}`
    for i in range(card_start + 1, min(card_start + 200, len(lines))):
        line = lines[i]
        # The pattern: after the card wrapper, we go back to the column heads map
        # Specific ending: the closing parens for the col.items.map and the column
        if line.strip() == '                      ))' and i > card_start + 50:
            card_end = i + 1  # include the closing paren
            break

print(f"Header start: line {header_start + 1 if header_start else 'not found'}")
print(f"Card start: line {card_start + 1 if card_start else 'not found'}")
print(f"Card end: line {card_end + 1 if card_end else 'not found'}")

if header_start is not None and card_start is not None and card_end is not None:
    # New column header (replace lines from header_start to header_start+8)
    new_header = [
        '                  {/* Column Header */}\n',
        '                  <div className="flex items-center justify-between px-4 py-3 mb-3 bg-white border border-zinc-200 rounded-xl shadow-sm">\n',
        '                    <div className="flex items-center gap-2.5">\n',
        '                      <div className={`h-2 w-2 rounded-full ${col.key === "pending" ? "bg-amber-500" : col.key === "in-progress" ? "bg-blue-500" : "bg-emerald-500"}`} />\n',
        '                      <h3 className="text-[13px] font-semibold text-zinc-800 tracking-tight">{col.label}</h3>\n',
        '                    </div>\n',
        '                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600 tabular-nums">\n',
        '                      {col.items.length}\n',
        '                    </span>\n',
        '                  </div>\n',
    ]
    
    # Replace header (9 lines)
    old_header_count = 10  # number of lines to replace
    lines[header_start:header_start + old_header_count] = new_header
    
    # Adjust card_start due to header replacement
    line_diff = len(new_header) - old_header_count
    card_start += line_diff
    card_end += line_diff
    
    # New card content
    new_card_content = [
        '                        <div\n',
        '                          key={task.id}\n',
        '                          className={`rounded-xl border bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${\n',
        '                            task.status === "pending" ? "border-amber-200 hover:border-amber-300" : \n',
        '                            task.status === "in-progress" ? "border-blue-200 hover:border-blue-300" : \n',
        '                            "border-emerald-200 hover:border-emerald-300"\n',
        '                          }`}\n',
        '                        >\n',
        '                          {/* Accent bar + top section */}\n',
        '                          <div className="flex">\n',
        '                            {/* Left accent bar */}\n',
        '                            <div className={`w-1 shrink-0 ${\n',
        '                              task.status === "pending" ? "bg-amber-400" : \n',
        '                              task.status === "in-progress" ? "bg-blue-400" : \n',
        '                              "bg-emerald-400"\n',
        '                            }`} />\n',
        '                            \n',
        '                            <div className="flex-1 px-4 pt-3.5 pb-2">\n',
        '                              {/* Top Row: Status Badge + Delete */}\n',
        '                              <div className="flex items-center justify-between mb-2.5">\n',
        '                                <div className="flex items-center gap-1.5">\n',
        '                                  {task.status === "pending" && (\n',
        '                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700 border border-amber-200/60">\n',
        '                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />\n',
        '                                      Pending\n',
        '                                    </span>\n',
        '                                  )}\n',
        '                                  {task.status === "in-progress" && (\n',
        '                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700 border border-blue-200/60">\n',
        '                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />\n',
        '                                      In Progress\n',
        '                                    </span>\n',
        '                                  )}\n',
        '                                  {task.status === "completed" && (\n',
        '                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700 border border-emerald-200/60">\n',
        '                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />\n',
        '                                      Completed\n',
        '                                    </span>\n',
        '                                  )}\n',
        '                                </div>\n',
        '                                <button\n',
        '                                  onClick={() => handleDeleteTask(task.id)}\n',
        '                                  className="grid h-6 w-6 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-all"\n',
        '                                  title="Delete task"\n',
        '                                >\n',
        '                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">\n',
        '                                    <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />\n',
        '                                  </svg>\n',
        '                                </button>\n',
        '                              </div>\n',
        '\n',
        '                              {/* Product Name + Qty */}\n',
        '                              <div className="flex items-center gap-2 mb-2">\n',
        '                                <h4 className="text-[15px] font-bold text-zinc-900 leading-tight tracking-tight">{task.product}</h4>\n',
        '                                {task.sourceQty && task.sourceQty > 1 && (\n',
        '                                  <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">\xd7{task.sourceQty}</span>\n',
        '                                )}\n',
        '                              </div>\n',
        '\n',
        '                              {/* Metadata Grid */}\n',
        '                              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-1">\n',
        '                                <div className="flex items-center gap-1.5">\n',
        '                                  <svg className="w-3.5 h-3.5 text-rose-400 shrink-0" viewBox="0 0 16 16" fill="none">\n',
        '                                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />\n',
        '                                    <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />\n',
        '                                  </svg>\n',
        '                                  <span className="text-[11px] text-zinc-600 font-medium">{task.theme}</span>\n',
        '                                </div>\n',
        '                                <div className="flex items-center gap-1.5">\n',
        '                                  <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" viewBox="0 0 16 16" fill="none">\n',
        '                                    <rect x="2" y="3.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />\n',
        '                                    <path d="M5 2v3M11 2v3M2 6.5h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />\n',
        '                                  </svg>\n',
        '                                  <span className="text-[11px] text-zinc-500 font-mono">{task.orderRef}</span>\n',
        '                                </div>\n',
        '                                {task.sourceProducedBy && (\n',
        '                                  <div className="flex items-center gap-1.5">\n',
        '                                    <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" viewBox="0 0 16 16" fill="none">\n',
        '                                      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />\n',
        '                                      <path d="M2 14c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />\n',
        '                                    </svg>\n',
        '                                    <span className="text-[11px] text-zinc-600 font-medium capitalize">{task.sourceProducedBy}</span>\n',
        '                                  </div>\n',
        '                                )}\n',
        '                              </div>\n',
        '                            </div>\n',
        '                          </div>\n',
        '\n',
        '                          {/* Notes */}\n',
        '                          {task.notes && (\n',
        '                            <div className="px-4 pb-2">\n',
        '                              <div className="flex items-start gap-2 rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">\n',
        '                                <svg className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" viewBox="0 0 16 16" fill="none">\n',
        '                                  <path d="M8 3v7M8 12v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />\n',
        '                                </svg>\n',
        '                                <p className="text-[11px] text-zinc-500 leading-relaxed">{task.notes}</p>\n',
        '                              </div>\n',
        '                            </div>\n',
        '                          )}\n',
        '\n',
        '                          {/* Materials Required (Pending & In Progress) */}\n',
        '                          {(task.status === "pending" || task.status === "in-progress") && (() => {\n',
        '                            const recipe = recipes.find(r => r.productName === task.product);\n',
        '                            if (!recipe || (recipe.packaging.length === 0 && recipe.decoration.length === 0)) return null;\n',
        '                            return (\n',
        '                              <div className="px-4 pb-3">\n',
        '                                <div className="rounded-lg border border-zinc-100 overflow-hidden">\n',
        '                                  <div className="bg-zinc-50/80 px-3 py-1.5 border-b border-zinc-100">\n',
        '                                    <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">Materials Required</span>\n',
        '                                  </div>\n',
        '                                  <div className="p-2.5 space-y-2">\n',
        '                                    {recipe.packaging.length > 0 && (\n',
        '                                      <div>\n',
        '                                        <span className="inline-flex items-center gap-1.5 mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-blue-600">\n',
        '                                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none">\n',
        '                                            <rect x="2" y="5.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />\n',
        '                                            <path d="M4 2.5h8M6 1h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />\n',
        '                                          </svg>\n',
        '                                          Packaging\n',
        '                                        </span>\n',
        '                                        <div className="flex flex-wrap gap-1.5">\n',
        '                                          {recipe.packaging.map((p, i) => (\n',
        '                                            <span key={i} className="inline-flex items-center gap-1.5 bg-white border border-blue-200/60 rounded-md px-2 py-1 text-[10px]">\n',
        '                                              <span className="text-zinc-700 font-medium">{p.name}</span>\n',
        '                                              <span className="text-blue-600 font-semibold tabular-nums">{Math.ceil(p.qtyPerBatch * (task.sourceQty || 1))}{p.unit}</span>\n',
        '                                            </span>\n',
        '                                          ))}\n',
        '                                        </div>\n',
        '                                      </div>\n',
        '                                    )}\n',
        '                                    {recipe.decoration.length > 0 && (\n',
        '                                      <div>\n',
        '                                        <span className="inline-flex items-center gap-1.5 mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-purple-600">\n',
        '                                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none">\n',
        '                                            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />\n',
        '                                            <path d="M8 3v2M8 11v2M3 8h2M11 8h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />\n',
        '                                          </svg>\n',
        '                                          Decoration\n',
        '                                        </span>\n',
        '                                        <div className="flex flex-wrap gap-1.5">\n',
        '                                          {recipe.decoration.map((d, i) => (\n',
        '                                            <span key={i} className="inline-flex items-center gap-1.5 bg-white border border-purple-200/60 rounded-md px-2 py-1 text-[10px]">\n',
        '                                              <span className="text-zinc-700 font-medium">{d.name}</span>\n',
        '                                              <span className="text-purple-600 font-semibold tabular-nums">{Math.ceil(d.qtyPerBatch * (task.sourceQty || 1))}{d.unit}</span>\n',
        '                                            </span>\n',
        '                                          ))}\n',
        '                                        </div>\n',
        '                                      </div>\n',
        '                                    )}\n',
        '                                  </div>\n',
        '                                </div>\n',
        '                              </div>\n',
        '                            );\n',
        '                          })()}\n',
        '\n',
        '                          {/* Actions */}\n',
        '                          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-zinc-100 bg-zinc-50/60">\n',
        '                            {task.status === "pending" && (\n',
        '                              <button\n',
        '                                onClick={() => handleForward(task)}\n',
        '                                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-500 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-rose-600 active:scale-[0.98] transition-all"\n',
        '                              >\n',
        '                                Start Decorating\n',
        '                                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">\n',
        '                                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />\n',
        '                                </svg>\n',
        '                              </button>\n',
        '                            )}\n',
        '                            {task.status === "in-progress" && (\n',
        '                              <>\n',
        '                                <button\n',
        '                                  onClick={() => handleBackward(task)}\n',
        '                                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.98] transition-all"\n',
        '                                >\n',
        '                                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">\n',
        '                                    <path d="M10 12l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />\n',
        '                                  </svg>\n',
        '                                  Back\n',
        '                                </button>\n',
        '                                <button\n',
        '                                  onClick={() => handleForward(task)}\n',
        '                                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-600 active:scale-[0.98] transition-all"\n',
        '                                >\n',
        '                                  Complete\n',
        '                                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">\n',
        '                                    <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />\n',
        '                                  </svg>\n',
        '                                </button>\n',
        '                              </>\n',
        '                            )}\n',
        '                            {task.status === "completed" && (\n',
        '                              <button\n',
        '                                onClick={() => handleBackward(task)}\n',
        '                                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.98] transition-all"\n',
        '                              >\n',
        '                                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">\n',
        '                                  <path d="M10 12l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />\n',
        '                                </svg>\n',
        '                                Move Back\n',
        '                              </button>\n',
        '                            )}\n',
        '                          </div>\n',
        '                        </div>\n',
    ]
    
    # Replace card range
    old_card_count = card_end - card_start
    lines[card_start:card_end] = new_card_content
    
    print(f"Replaced {old_card_count} lines with {len(new_card_content)} lines for cards")
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.writelines(lines)
    
    print("File saved successfully!")
else:
    print("Could not find all sections.")
    sys.exit(1)
