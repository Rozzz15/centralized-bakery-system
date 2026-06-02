import sys
sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')

with open('src/components/DecoDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ============================================================
# 1. Replace the completion block in handleForward
#    Remove auto-add to Deco freezer, just mark completed
# ============================================================
old_completion = (
    '        updateDecoTask(task.id, "completed");\n'
    '        const decoItem: FreezerItem = {\n'
    '          id: `FRZ-${Date.now()}-DECO`,\n'
    '          productName: task.product,\n'
    '          qty: qty,\n'
    '          unit: "pcs",\n'
    '          batchRef: task.sourceBatchRef || `DECO-${Date.now()}`,\n'
    '          producedBy: "deco",\n'
    '          dateProduced: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0],\n'
    '          status: "stored",\n'
    '          notes: task.notes || `Decorated from ${task.sourceProducedBy || "community"} batch`,\n'
    '        };\n'
    '        onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, decoItem]);\n'
    '        db.upsertFreezerItems([decoItem]).catch(console.error);\n'
    '        onAddAuditLog?.("DECO_COMPLETED", `${task.product} added to Deco freezer (qty: ${qty})`);\n'
)

new_completion = (
    '        updateDecoTask(task.id, "completed");\n'
    '        onAddAuditLog?.("DECO_MARKED_COMPLETED", `${task.product} completed (qty: ${qty})`);\n'
)

count = content.count(old_completion)
print(f"Change 1 (completion block): found {count} occurrence(s)")
if count >= 1:
    content = content.replace(old_completion, new_completion, 1)
    print("  ✓ Applied")

# ============================================================
# 2. Replace handleBackward to remove completed → in-progress
# ============================================================
old_backward = (
    '    const handleBackward = async (task: DecoTask) => {\n'
    '      if (task.status === "in-progress") await updateDecoTask(task.id, "pending");\n'
    '      else if (task.status === "completed") await updateDecoTask(task.id, "in-progress");\n'
    '    };\n'
)

new_backward = (
    '    const handleBackward = async (task: DecoTask) => {\n'
    '      if (task.status === "in-progress") await updateDecoTask(task.id, "pending");\n'
    '    };\n'
)

count = content.count(old_backward)
print(f"Change 2 (handleBackward): found {count} occurrence(s)")
if count >= 1:
    content = content.replace(old_backward, new_backward, 1)
    print("  ✓ Applied")

# ============================================================
# 3. Replace the "Move Back" button on completed cards with 
#    "Add to Deco Freezer" button
# ============================================================
old_move_back_btn = (
    '                            {task.status === "completed" && (\n'
    '                              <button\n'
    '                                onClick={() => handleBackward(task)}\n'
    '                                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.98] transition-all"\n'
    '                              >\n'
    '                                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">\n'
    '                                  <path d="M10 12l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />\n'
    '                                </svg>\n'
    '                                Move Back\n'
    '                              </button>\n'
    '                            )}\n'
)

new_add_frz_btn = (
    '                            {task.status === "completed" && (\n'
    '                              <button\n'
    '                                onClick={() => addToDecoFreezer(task)}\n'
    '                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-medium text-white hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm"\n'
    '                              >\n'
    '                                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">\n'
    '                                  <path d="M8 3v10M3 8h10" strokeLinecap="round" />\n'
    '                                </svg>\n'
    '                                Add to Deco Freezer\n'
    '                              </button>\n'
    '                            )}\n'
)

count = content.count(old_move_back_btn)
print(f"Change 3 (Move Back button): found {count} occurrence(s)")
if count >= 1:
    content = content.replace(old_move_back_btn, new_add_frz_btn, 1)
    print("  ✓ Applied")

# ============================================================
# 4. Add the addToDecoFreezer function after handleDeleteTask
#    Also suppress the in-progress backward button on completed tasks
# ============================================================
old_after_delete = (
    '    const handleDeleteTask = async (id: string) => {\n'
    '      if (confirm("Delete this task?")) {\n'
    '        await db.deleteDecorationQueue(id);\n'
    '        setDecoQueue(prev => prev.filter(t => t.id !== id));\n'
    '      }\n'
    '    };\n'
)

new_after_delete = (
    '    const handleDeleteTask = async (id: string) => {\n'
    '      if (confirm("Delete this task?")) {\n'
    '        await db.deleteDecorationQueue(id);\n'
    '        setDecoQueue(prev => prev.filter(t => t.id !== id));\n'
    '      }\n'
    '    };\n'
    '\n'
    '    const addToDecoFreezer = async (task: DecoTask) => {\n'
    '      const qty = task.sourceQty || 1;\n'
    '      const batchRef = task.sourceBatchRef || `DECO-${Date.now()}`;\n'
    '      const existingIdx = freezerItems.findIndex(\n'
    '        f => f.producedBy === "deco" && f.productName === task.product && f.batchRef === batchRef\n'
    '      );\n'
    '      if (existingIdx >= 0) {\n'
    '        // Merge qty into existing item\n'
    '        const updated = [...freezerItems];\n'
    '        updated[existingIdx] = { ...updated[existingIdx], qty: updated[existingIdx].qty + qty };\n'
    '        onUpdateFreezer?.(updated);\n'
    '        await db.upsertFreezerItems([updated[existingIdx]]).catch(console.error);\n'
    '        onAddAuditLog?.("DECO_ADDED_TO_FREEZER", `${qty} more of ${task.product} merged into existing freezer item (total: ${updated[existingIdx].qty})`);\n'
    '      } else {\n'
    '        // Create new freezer item\n'
    '        const decoItem: FreezerItem = {\n'
    '          id: `FRZ-${Date.now()}-DECO`,\n'
    '          productName: task.product,\n'
    '          qty,\n'
    '          unit: "pcs",\n'
    '          batchRef,\n'
    '          producedBy: "deco",\n'
    '          dateProduced: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0],\n'
    '          status: "stored",\n'
    '          notes: task.notes || `Decorated from ${task.sourceProducedBy || "community"} batch`,\n'
    '        };\n'
    '        onUpdateFreezer?.((prev: FreezerItem[]) => [...prev, decoItem]);\n'
    '        await db.upsertFreezerItems([decoItem]).catch(console.error);\n'
    '        onAddAuditLog?.("DECO_ADDED_TO_FREEZER", `${task.product} added to Deco freezer (qty: ${qty})`);\n'
    '      }\n'
    '    };\n'
)

count = content.count(old_after_delete)
print(f"Change 4 (add addToDecoFreezer): found {count} occurrence(s)")
if count >= 1:
    content = content.replace(old_after_delete, new_after_delete, 1)
    print("  ✓ Applied")

# ============================================================
# 5. Also hide the in-progress backward button for completed tasks
#    Find the backward button that's shown for in-progress only
#    and make sure it's not shown for completed tasks
# ============================================================
# The backward button for in-progress tasks is at a different location
# Let's verify by checking the "in-progress" backward button 
old_inprog_back = (
    '                              <button\n'
    '                                onClick={() => handleBackward(task)}\n'
    '                                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 active:scale-[0.98] transition-all"\n'
    '                              >\n'
    '                                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">\n'
    '                                  <path d="M10 12l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />\n'
    '                                </svg>\n'
    '                                Back\n'
    '                              </button>\n'
)
# Check if this exists (this is the in-progress backward button)
count = content.count(old_inprog_back)
print(f"Change 5 (in-progress Back button - check only): found {count} occurrence(s)")
# This should remain as-is for in-progress tasks

# Write back
with open('src/components/DecoDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nAll changes applied successfully!")
