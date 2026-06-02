import sys
import io

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# ─── Fix 1: Update workflowSteps in DecoDashboard.tsx ───
with open("src/components/DecoDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

old_workflow = """  const workflowSteps = [
    { id: "dashboard", label: "DOS Received" },
    { id: "free-mix", label: "Production Prep" },
    { id: "deco-queue", label: "Decoration Queue" },
    { id: "custom-orders", label: "Custom Orders" },
  ];"""

new_workflow = """  const workflowSteps = [
    { id: "dashboard", label: "DOS Received" },
    { id: "free-mix", label: "Production Prep" },
    { id: "deco-queue", label: "Decoration Queue" },
    { id: "freezer", label: "Finished Products" },
  ];"""

if old_workflow in content:
    content = content.replace(old_workflow, new_workflow)
    print("OK - Updated workflowSteps")
else:
    print("FAIL - Could not find old workflowSteps")

# ─── Fix 2: Insert Production Prep section ───
insertion_marker = """  }

  /* \u2500\u2500 Advanced Freemix \u2500\u2500 */
  if (activeTab === "adv-freemix") {"""

prod_prep = """  }

  /* \u2500\u2500 Production Prep \u2500\u2500 */
  if (activeTab === "free-mix") {
    const preppedProducts = new Set(freeMixDone);
    const totalToPrep = dosForDeco.length;
    const totalPreppedCount = dosForDeco.filter(d => preppedProducts.has(d.product)).length;
    const remainingCount = totalToPrep - totalPreppedCount;

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">Production Prep</h1>
            <p className="mt-1 text-[13px] text-zinc-500">
              Review the recipe formulas for each DOS product, prepare the ingredient pre-mixes, then proceed to Decoration.
            </p>
          </div>
          <div className="shrink-0 rounded-xl bg-rose-100 px-4 py-2.5 text-center">
            <div className="text-[10px] text-rose-600 uppercase font-medium tracking-wider">Prep Progress</div>
            <div className="text-[22px] font-bold text-zinc-900 mt-0.5" style={{ fontFamily: "Fragment Mono, monospace" }}>{totalPreppedCount}/{totalToPrep}</div>
            <div className="text-[10px] text-rose-500">{remainingCount > 0 ? `${remainingCount} remaining` : "All done!"}</div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Products to Prep</div>
            <div className="text-[22px] font-semibold mt-0.5">{totalToPrep}</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="text-[11px] text-emerald-500 uppercase tracking-wider">Prepped</div>
            <div className="text-[22px] font-semibold mt-0.5 text-emerald-700">{totalPreppedCount}</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            <div className="text-[11px] text-amber-500 uppercase tracking-wider">Remaining</div>
            <div className="text-[22px] font-semibold mt-0.5 text-amber-700">{remainingCount}</div>
          </div>
        </div>

        {dosForDeco.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
            <p className="text-[14px] text-zinc-400">No DOS items to prepare.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dosForDeco.map(d => {
              const productRecipes = getRecipesForProduct(d.product);
              const isPrepped = preppedProducts.has(d.product);
              const pColor = d.priority === "HIGH" ? "bg-red-100 text-red-700" : d.priority === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600";
              return (
                <div key={d.id} className="rounded-2xl border-2 border-zinc-100 bg-white p-5 hover:border-zinc-300 hover:shadow-sm transition-all">
                  {/* Product header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="text-[17px] font-bold text-zinc-900">{d.product}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[12px] text-zinc-500 font-mono">Qty: {d.qty}</span>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${pColor}`}>{d.priority}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                      isPrepped
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {isPrepped ? "OK Prepped" : "Not Ready"}
                    </div>
                  </div>

                  {/* Recipe formula cards */}
                  {productRecipes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-200 p-5 text-center">
                      <p className="text-[13px] text-zinc-400 italic">No recipe formulas set for this product.</p>
                      <p className="text-[11px] text-zinc-400 mt-1">Ask Admin to set up recipes in Products tab.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {productRecipes.map(r => {
                        const totalItems = r.ingredients.length + r.packaging.length + r.decoration.length;
                        const isPrimary = r.productName === d.product;
                        return (
                          <div key={r.productName} className="rounded-2xl border-2 border-zinc-100 bg-white p-4">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-[15px] font-bold text-zinc-900">{r.productName}</h4>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                isPrimary ? "bg-rose-100 text-rose-700" : "bg-zinc-100 text-zinc-500"
                              }`}>
                                {isPrimary ? "Primary" : "Linked"}
                              </span>
                            </div>

                            {/* Composition tags */}
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {r.ingredients.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                                  {r.ingredients.length} ingredient{r.ingredients.length !== 1 ? "s" : ""}
                                </span>
                              )}
                              {r.packaging.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                  {r.packaging.length} pack
                                </span>
                              )}
                              {r.decoration.length > 0 && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                                  {r.decoration.length} deco
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                                {totalItems} item{totalItems !== 1 ? "s" : ""}
                              </span>
                            </div>

                            {/* Ingredients */}
                            {r.ingredients.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-zinc-100">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Ingredients</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {r.ingredients.slice(0, 6).map((ing, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px]">
                                      <span className="text-zinc-700 font-medium">{ing.name}</span>
                                      <span className="text-rose-600 font-mono">{ing.qtyPerBatch}{ing.unit}</span>
                                    </span>
                                  ))}
                                  {r.ingredients.length > 6 && (
                                    <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">+{r.ingredients.length - 6} more</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Packaging */}
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
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100">
                    <button
                      onClick={() => setActiveTab("adv-freemix")}
                      className="rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all"
                    >
                      Prepare in Advanced Freemix ->
                    </button>
                    <button
                      onClick={() => {
                        if (isPrepped) {
                          setFreeMixDone(prev => { const n = new Set(prev); n.delete(d.product); return n; });
                        } else {
                          setFreeMixDone(prev => new Set(prev).add(d.product));
                        }
                      }}
                      className={`rounded-xl px-4 py-2 text-[13px] font-medium transition-all ${
                        isPrepped
                          ? "border-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-2 border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                      }`}
                    >
                      {isPrepped ? "Mark as Not Ready" : "Mark as Prepared"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Workflow Nav */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
          <div className="text-[12px] text-zinc-400">Step {currentStepIdx + 1} of {workflowSteps.length}</div>
          {nextStep && (
            <button onClick={() => setActiveTab(nextStep.id)} className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all">
              Next: {nextStep.label} ->
            </button>
          )}
        </div>
      </div>
    );
  }

  /* \u2500\u2500 Advanced Freemix \u2500\u2500 */
  if (activeTab === "adv-freemix") {"""

if insertion_marker in content:
    content = content.replace(insertion_marker, prod_prep)
    print("OK - Inserted Production Prep section")
else:
    print("FAIL - Could not find insertion marker")

with open("src/components/DecoDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)

# ─── Fix 3: Remove custom-orders from App.tsx deco whitelist ───
with open("src/App.tsx", "r", encoding="utf-8") as f:
    app_content = f.read()

old_wl = 'role === "deco" && ["dashboard", "free-mix", "adv-freemix", "deco-queue", "custom-orders", "inventory", "freezer"].includes(activeTab)'
new_wl = 'role === "deco" && ["dashboard", "free-mix", "adv-freemix", "deco-queue", "inventory", "freezer"].includes(activeTab)'

if old_wl in app_content:
    app_content = app_content.replace(old_wl, new_wl)
    print("OK - Removed custom-orders from App.tsx")
else:
    print("FAIL - Could not find deco whitelist in App.tsx")

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(app_content)

print("\nDone! All fixes applied.")
