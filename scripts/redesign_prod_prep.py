import re

with open("src/components/DecoDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# ─── 1. Add "Back" button in Production Prep workflow nav ───
# Find the second Workflow Nav (Production Prep section, line 837)
# Replace the Workflow Nav block in Production Prep to add a Back button
# The pattern to match is:
# <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
#   <div className="text-[12px] text-zinc-400">Step {currentStepIdx + 1} of {workflowSteps.length}</div>
#   {nextStep && (
#     <button ...>Next: {nextStep.label} →</button>
#   )}
# </div>
# We need to add a Back button on the LEFT side

# Target the SECOND occurrence (Production Prep section, not DOS Received)
old_workflow = """        {/* Workflow Nav */}
        <div className=\"flex items-center justify-between pt-4 border-t border-zinc-100\">
          <div className=\"text-[12px] text-zinc-400\">Step {currentStepIdx + 1} of {workflowSteps.length}</div>
          {nextStep && (
            <button onClick={() => setActiveTab(nextStep.id)} className=\"rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all\">
              Next: {nextStep.label} →
            </button>
          )}
        </div>"""

new_workflow = """        {/* Workflow Nav */}
        <div className=\"flex items-center justify-between pt-4 border-t border-zinc-100\">
          <div className=\"text-[12px] text-zinc-400\">Step {currentStepIdx + 1} of {workflowSteps.length}</div>
          <div className=\"flex items-center gap-2\">
            <button onClick={() => setActiveTab(\"dashboard\")} className=\"rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-50 hover:border-zinc-400 transition-all\">
              ← Back to DOS Received
            </button>
            {nextStep && (
              <button onClick={() => setActiveTab(nextStep.id)} className=\"rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all\">
                Next: {nextStep.label} →
              </button>
            )}
          </div>
        </div>"""

# Only replace the SECOND occurrence
idx = content.find(old_workflow)
if idx >= 0:
    idx2 = content.find(old_workflow, idx + 1)
    if idx2 >= 0:
        content = content[:idx2] + new_workflow + content[idx2 + len(old_workflow):]
        print("✓ Added Back button to Production Prep workflow nav")
    else:
        print("! Could not find second Workflow Nav occurrence")
else:
    print("! Could not find Workflow Nav pattern")

# ─── 2. Remove redundant "X items" badge from primary recipe inline section ───
# The pattern is: 
# <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
#   {primary.ingredients.length + primary.packaging.length + primary.decoration.length} item{(primary.ingredients.length + primary.packaging.length + primary.decoration.length) !== 1 ? "s" : ""}
# </span>
old_primary_items = """                                  <span className=\"inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600\">
                                    {primary.ingredients.length + primary.packaging.length + primary.decoration.length} item{(primary.ingredients.length + primary.packaging.length + primary.decoration.length) !== 1 ? \"s\" : \"\"}
                                  </span>"""

if old_primary_items in content:
    content = content.replace(old_primary_items, "")
    print("✓ Removed redundant 'X items' from primary recipe section")
else:
    print("! Could not find primary recipe 'X items' pattern")

# ─── 3. Remove redundant "X items" badge from linked recipe cards in Production Prep ───
# Pattern: 
#                                         <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
#                                           {totalItems} item{totalItems !== 1 ? "s" : ""}
#                                         </span>
old_linked_items = """                                        <span className=\"inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600\">
                                          {totalItems} item{totalItems !== 1 ? \"s\" : \"\"}
                                        </span>"""

if old_linked_items in content:
    content = content.replace(old_linked_items, "")
    print("✓ Removed redundant 'X items' from linked recipe cards")
else:
    print("! Could not find linked recipe 'X items' pattern")

# Check count of remaining occurrences
remaining = content.count("} item{")
print(f"  Remaining 'X items' occurrences: {remaining}")

# ─── 4. Center the recipe name in linked recipe cards ───
# Change:
# <h4 className="text-[15px] font-bold text-zinc-900">{r.productName}</h4>
# To also center the badge, wrap in text-center container
old_name = """                                      <div className=\"flex items-start justify-between gap-2\">
                                        <h4 className=\"text-[15px] font-bold text-zinc-900\">{r.productName}</h4>
                                        <span className=\"shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500\">
                                          Linked
                                        </span>
                                      </div>"""

new_name = """                                      <div className=\"text-center mb-3\">
                                        <h4 className=\"text-[15px] font-bold text-zinc-900\">{r.productName}</h4>
                                        <span className=\"inline-block mt-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500\">
                                          Linked
                                        </span>
                                      </div>"""

if old_name in content:
    content = content.replace(old_name, new_name)
    print("✓ Centered recipe name in linked recipe cards")
else:
    print("! Could not find linked recipe name header")

with open("src/components/DecoDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("\n✅ All changes applied!")
