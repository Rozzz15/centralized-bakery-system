import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = "C:/Users/Admin/Desktop/Businesses/CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM/src/components/DecoDashboard.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# ─── Fix 1: Expanded DOS row - hide recipe name when same as product ───
old1 = """                                return validRecipes.map(r => (
                                  <div key={r.productName}>
                                    <div className=\"text-[11px] font-medium text-zinc-500 mb-1\">{r.productName}</div>
                                    <div className=\"flex flex-wrap gap-1.5\">"""

new1 = """                                return validRecipes.map(r => {
                                  const isPrimaryRecipe = r.productName === d.product;
                                  return (
                                  <div key={r.productName}>
                                    {!isPrimaryRecipe && <div className=\"text-[11px] font-medium text-zinc-500 mb-1\">{r.productName}</div>}
                                    <div className=\"flex flex-wrap gap-1.5\">"""

if old1 in content:
    # Need to also fix the closing JSX - change ) to );
    # The old: ))} becomes );)}) -- let me also update the closing
    content = content.replace(old1, new1)
    changes += 1
    print("✅ Fix 1: Expanded DOS row - hid recipe name when same as product")
    
    # Also fix the closing - the old code uses: ))} which closes the map and the IIFE
    # The new code uses: r => { ... return (...); } which needs ); })} 
    # Actually looking at it, the original is:
    # return validRecipes.map(r => (
    #   <div>...</div>
    # ));
    # After adding { const isPrimaryRecipe ...; return (...); }, it becomes:
    # return validRecipes.map(r => {
    #   const isPrimaryRecipe = ...;
    #   return (<div>...</div>);
    # });
    # The closing should be ); })} instead of ))}
    old_close = """                                    </div>
                                  </div>
                                ));
                              })()}"""
    new_close = """                                    </div>
                                  </div>
                                );
                              })()}"""
    
    # Check which variant exists
    if old_close in content:
        content = content.replace(old_close, new_close)
        print("✅ Fixed closing for expanded row map")
    else:
        # Try without the semicolon
        alt_close = """                                    </div>
                                  </div>
                                ));
                              })()"""
        if alt_close in content:
            content = content.replace(alt_close, new_close)
            print("✅ Fixed closing for expanded row map (alt)")
else:
    print("❌ Fix 1: Could not find marker")
    # Debug
    idx = content.find("validRecipes.map(r =>")
    if idx >= 0:
        print(f"  Found 'validRecipes.map(r =>' at {idx}")
        print(f"  Context: {content[idx:idx+300]}")

# ─── Fix 2: Production Prep - show primary recipe inline, linked as separate cards ───
# The current structure has productRecipes.map(r => { ... return (<div className="rounded-2xl ...card..."> ... </div>) })
# We need to split: show primary recipe content inline under product header, linked recipes as cards

old2 = """                  {/* Recipe formula cards */}
                  {productRecipes.length === 0 ? (
                    <div className=\"rounded-xl border border-dashed border-zinc-200 p-5 text-center\">
                      <p className=\"text-[13px] text-zinc-400 italic\">No recipe formulas set for this product.</p>
                      <p className=\"text-[11px] text-zinc-400 mt-1\">Ask Admin to set up recipes in Products tab.</p>
                    </div>
                  ) : (
                    <div className=\"grid grid-cols-1 sm:grid-cols-2 gap-3\">
                      {productRecipes.map(r => {
                        const totalItems = r.ingredients.length + r.packaging.length + r.decoration.length;
                        const isPrimary = r.productName === d.product;
                        return (
                          <div key={r.productName} className=\"rounded-2xl border-2 border-zinc-100 bg-white p-4\">
                            <div className=\"flex items-start justify-between gap-2\">
                              <h4 className=\"text-[15px] font-bold text-zinc-900\">{r.productName}</h4>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                isPrimary ? \"bg-rose-100 text-rose-700\" : \"bg-zinc-100 text-zinc-500\"
                              }`}>
                                {isPrimary ? \"Primary\" : \"Linked\"}
                              </span>
                            </div>

                            {/* Composition tags */}
                            <div className=\"flex flex-wrap gap-1.5 mt-3\">
                              {r.ingredients.length > 0 && (
                                <span className=\"inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700\">
                                  {r.ingredients.length} ingredient{r.ingredients.length !== 1 ? \"s\" : \"\"}
                                </span>
                              )}
                              {r.packaging.length > 0 && (
                                <span className=\"inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700\">
                                  {r.packaging.length} pack
                                </span>
                              )}
                              {r.decoration.length > 0 && (
                                <span className=\"inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700\">
                                  {r.decoration.length} deco
                                </span>
                              )}
                              <span className=\"inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600\">
                                {totalItems} item{totalItems !== 1 ? \"s\" : \"\"}
                              </span>
                            </div>

                            {/* Ingredients */}
                            {r.ingredients.length > 0 && (
                              <div className=\"mt-3 pt-3 border-t border-zinc-100\">
                                <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5\">Ingredients</div>
                                <div className=\"flex flex-wrap gap-1.5\">
                                  {r.ingredients.slice(0, 6).map((ing, i) => (
                                    <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px]\">
                                      <span className=\"text-zinc-700 font-medium\">{ing.name}</span>
                                      <span className=\"text-rose-600 font-mono\">{ing.qtyPerBatch}{ing.unit}</span>
                                    </span>
                                  ))}
                                  {r.ingredients.length > 6 && (
                                    <span className=\"inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500\">+{r.ingredients.length - 6} more</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Packaging */}
                            {r.packaging.length > 0 && ("""

# Since this is a large block, let me verify it exists first
if old2 in content:
    print("✅ Fix 2: Found Production Prep section marker")
    
    # Find the end of this block - after the closing </div> of the card
    # Looking for: the closing )} of productRecipes.map and </div> of the grid
    end_marker = """                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}"""
    
    if end_marker in content:
        # Find this specific occurrence after old2
        start_pos = content.find(old2)
        end_pos = content.find(end_marker, start_pos)
        if end_pos >= 0:
            full_block = content[start_pos:end_pos + len(end_marker)]
            
            # Build the replacement
            new2 = """                  {/* Recipe formula cards */}
                  {productRecipes.length === 0 ? (
                    <div className=\"rounded-xl border border-dashed border-zinc-200 p-5 text-center\">
                      <p className=\"text-[13px] text-zinc-400 italic\">No recipe formulas set for this product.</p>
                      <p className=\"text-[11px] text-zinc-400 mt-1\">Ask Admin to set up recipes in Products tab.</p>
                    </div>
                  ) : (
                    <div className=\"space-y-3\">
                      {(() => {
                        const primaryRecipe = productRecipes.find(r => r.productName === d.product);
                        const linkedRecipes = productRecipes.filter(r => r.productName !== d.product);
                        return <>
                          {primaryRecipe && (
                            <div className=\"rounded-2xl border-2 border-rose-100 bg-rose-50/30 p-4\">
                              <div className=\"flex items-center gap-2 mb-3\">
                                <h4 className=\"text-[15px] font-bold text-zinc-900\">Recipe Ingredients</h4>
                                <span className=\"inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700\">
                                  {primaryRecipe.ingredients.length} ingredient{primaryRecipe.ingredients.length !== 1 ? \"s\" : \"\"}
                                </span>
                                {primaryRecipe.packaging.length > 0 && (
                                  <span className=\"inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700\">
                                    {primaryRecipe.packaging.length} pack
                                  </span>
                                )}
                                {primaryRecipe.decoration.length > 0 && (
                                  <span className=\"inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700\">
                                    {primaryRecipe.decoration.length} deco
                                  </span>
                                )}
                              </div>

                              {/* Ingredients */}
                              {primaryRecipe.ingredients.length > 0 && (
                                <div className=\"mb-3\">
                                  <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5\">Ingredients</div>
                                  <div className=\"flex flex-wrap gap-1.5\">
                                    {primaryRecipe.ingredients.slice(0, 6).map((ing, i) => (
                                      <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px]\">
                                        <span className=\"text-zinc-700 font-medium\">{ing.name}</span>
                                        <span className=\"text-rose-600 font-mono\">{ing.qtyPerBatch}{ing.unit}</span>
                                      </span>
                                    ))}
                                    {primaryRecipe.ingredients.length > 6 && (
                                      <span className=\"inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500\">+{primaryRecipe.ingredients.length - 6} more</span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Packaging */}
                              {primaryRecipe.packaging.length > 0 && (
                                <div className=\"mb-3\">
                                  <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5\">Packaging Materials</div>
                                  <div className=\"flex flex-wrap gap-1.5\">
                                    {primaryRecipe.packaging.slice(0, 4).map((pkg, i) => (
                                      <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-blue-200 px-1.5 py-0.5 text-[10px]\">
                                        <span className=\"text-zinc-700 font-medium\">{pkg.name}</span>
                                        <span className=\"text-blue-600 font-mono\">{pkg.qtyPerBatch}{pkg.unit}</span>
                                      </span>
                                    ))}
                                    {primaryRecipe.packaging.length > 4 && (
                                      <span className=\"inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500\">+{primaryRecipe.packaging.length - 4} more</span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Deco Supplies */}
                              {primaryRecipe.decoration.length > 0 && (
                                <div>
                                  <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5\">Deco Supplies</div>
                                  <div className=\"flex flex-wrap gap-1.5\">
                                    {primaryRecipe.decoration.slice(0, 4).map((deco, i) => (
                                      <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-purple-200 px-1.5 py-0.5 text-[10px]\">
                                        <span className=\"text-zinc-700 font-medium\">{deco.name}</span>
                                        <span className=\"text-purple-600 font-mono\">{deco.qtyPerBatch}{deco.unit}</span>
                                      </span>
                                    ))}
                                    {primaryRecipe.decoration.length > 4 && (
                                      <span className=\"inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500\">+{primaryRecipe.decoration.length - 4} more</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {linkedRecipes.map(r => {
                            const totalItems = r.ingredients.length + r.packaging.length + r.decoration.length;
                            return (
                              <div key={r.productName} className=\"rounded-2xl border-2 border-zinc-100 bg-white p-4\">
                                <div className=\"flex items-start justify-between gap-2\">
                                  <h4 className=\"text-[15px] font-bold text-zinc-900\">{r.productName}</h4>
                                  <span className=\"shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500\">Linked</span>
                                </div>

                                {/* Composition tags */}
                                <div className=\"flex flex-wrap gap-1.5 mt-3\">
                                  {r.ingredients.length > 0 && (
                                    <span className=\"inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700\">
                                      {r.ingredients.length} ingredient{r.ingredients.length !== 1 ? \"s\" : \"\"}
                                    </span>
                                  )}
                                  {r.packaging.length > 0 && (
                                    <span className=\"inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700\">
                                      {r.packaging.length} pack
                                    </span>
                                  )}
                                  {r.decoration.length > 0 && (
                                    <span className=\"inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700\">
                                      {r.decoration.length} deco
                                    </span>
                                  )}
                                  <span className=\"inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600\">
                                    {totalItems} item{totalItems !== 1 ? \"s\" : \"\"}
                                  </span>
                                </div>

                                {/* Ingredients */}
                                {r.ingredients.length > 0 && (
                                  <div className=\"mt-3 pt-3 border-t border-zinc-100\">
                                    <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5\">Ingredients</div>
                                    <div className=\"flex flex-wrap gap-1.5\">
                                      {r.ingredients.slice(0, 6).map((ing, i) => (
                                        <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-rose-200 px-1.5 py-0.5 text-[10px]\">
                                          <span className=\"text-zinc-700 font-medium\">{ing.name}</span>
                                          <span className=\"text-rose-600 font-mono\">{ing.qtyPerBatch}{ing.unit}</span>
                                        </span>
                                      ))}
                                      {r.ingredients.length > 6 && (
                                        <span className=\"inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500\">+{r.ingredients.length - 6} more</span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Packaging */}
                                {r.packaging.length > 0 && ("""
            
            # Now we need the rest of the old block after the packaging section
            # Find the closing of packaging, deco, and card in old2
            # The old block includes the packaging section start, then continues with deco and closing
            # Let me find where the full old block ends
            # After the packaging start, there's the deco section and closing
            # Let me find the full end of the old block
            
            # Instead of trying to match the full block, let me use a different approach
            # Find the packaging section start in the old content and replace everything from there
            # to the end of the card
            
            # Find the complete old block from old2 start to end_marker end
            full_old = content[start_pos:end_pos + len(end_marker)]
            
            # Find packaging section closing and deco section
            packaging_deco_end = """                            {r.packaging.length > 0 && (
                              <div className=\"mt-3 pt-3 border-t border-zinc-100\">
                                <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5\">Packaging Materials</div>
                                <div className=\"flex flex-wrap gap-1.5\">
                                  {r.packaging.slice(0, 4).map((pkg, i) => (
                                    <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-blue-200 px-1.5 py-0.5 text-[10px]\">
                                      <span className=\"text-zinc-700 font-medium\">{pkg.name}</span>
                                      <span className=\"text-blue-600 font-mono\">{pkg.qtyPerBatch}{pkg.unit}</span>
                                    </span>
                                  ))}
                                  {r.packaging.length > 4 && (
                                    <span className=\"inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500\">+{r.packaging.length - 4} more</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Deco Supplies */}
                            {r.decoration.length > 0 && (
                              <div className=\"mt-3 pt-3 border-t border-zinc-100\">
                                <div className=\"text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5\">Deco Supplies</div>
                                <div className=\"flex flex-wrap gap-1.5\">
                                  {r.decoration.slice(0, 4).map((deco, i) => (
                                    <span key={i} className=\"inline-flex items-center gap-1 rounded-md bg-white border border-purple-200 px-1.5 py-0.5 text-[10px]\">
                                      <span className=\"text-zinc-700 font-medium\">{deco.name}</span>
                                      <span className=\"text-purple-600 font-mono\">{deco.qtyPerBatch}{deco.unit}</span>
                                    </span>
                                  ))}
                                  {r.decoration.length > 4 && (
                                    <span className=\"inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500\">+{r.decoration.length - 4} more</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}"""
            
            # Check if this is the exact ending
            if packaging_deco_end in content:
                pde_pos = content.find(packaging_deco_end, start_pos)
                if pde_pos >= 0:
                    full_old_block = content[start_pos:pde_pos + len(packaging_deco_end)]
                    full_new_block = new2 + packaging_deco_end
                    content = content.replace(full_old_block, full_new_block)
                    changes += 1
                    print("✅ Fix 2: Production Prep - primary recipe shown inline, linked as separate cards")
                else:
                    print("❌ Fix 2: Could not find packaging_deco_end after start_pos")
            else:
                print("❌ Fix 2: packaging_deco_end not found in file")
        else:
            print("❌ Fix 2: end_marker not found after old2")
    else:
        print("❌ Fix 2: end_marker not found")
else:
    print("❌ Fix 2: Could not find Production Prep marker")
    # Debug what's around productRecipes.map
    idx = content.find("productRecipes.map(r =>")
    if idx >= 0:
        print(f"  Found 'productRecipes.map(r =>' at {idx}")
        print(f"  Context: {content[idx:idx+200]}")

if changes > 0:
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"\n✅ Applied {changes} fixes")
else:
    print("\n❌ No fixes applied")
