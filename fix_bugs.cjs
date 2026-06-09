const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src", "components", "DecoDashboard.tsx");
let content = fs.readFileSync(filePath, "utf8");

// Fix 1: Add DOSRecipeDetailModal render before the closing of task list view
// Find the workflow nav closing div and insert the modal before it
const oldNav = `            <div className=\"text-[12px] text-zinc-500\">Step 1 of 5</div>`;
const newNav = `          {/* DOS Recipe Detail Modal */}
          {viewingDOSRecipe && (
            <DOSRecipeDetailModal
              recipe={viewingDOSRecipe.recipe}
              totalQty={viewingDOSRecipe.totalQty}
              onClose={() => setViewingDOSRecipe(null)}
              onSaveYield={(newYield) => {
                const updated = { ...viewingDOSRecipe.recipe, yield: newYield };
                setViewingDOSRecipe({ ...viewingDOSRecipe, recipe: updated });
                if (onUpdateRecipes) {
                  onUpdateRecipes(prev => prev.map(r => r.productName === updated.productName ? updated : r));
                }
                db.upsertRecipe(updated).catch(console.error);
              }}
            />
          )}

          {/* Workflow Nav */}
          <div className=\"flex items-center justify-between pt-4 border-t border-zinc-700\">
            <div className=\"text-[12px] text-zinc-500\">Step 1 of 5</div>`;

if (content.includes(oldNav)) {
  content = content.replace(oldNav, newNav);
  console.log("✅ Fix 1: Added DOSRecipeDetailModal render");
} else {
  console.log("❌ Fix 1: Could not find workflow nav marker");
}

// Fix 2: Merge savedAddIngs with additionalIngredients
const oldMerge = "      const finalAddIngs = [...additionalIngredients];";
const newMerge = "      const finalAddIngs = [...savedAddIngs, ...additionalIngredients];";
if (content.includes(oldMerge)) {
  content = content.replace(oldMerge, newMerge);
  console.log("✅ Fix 2: Fixed additional ingredients merge");
} else {
  console.log("❌ Fix 2: Could not find merge line");
}

fs.writeFileSync(filePath, content, "utf8");
console.log("\n✅ All fixes applied!");
