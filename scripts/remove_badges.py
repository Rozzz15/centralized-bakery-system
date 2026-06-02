import re

with open(r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Pattern 1: Remove the badge span from the recipe chip
# Find: validRecipes.map(r => { const isPrimary = ... badge span ... 
old = r"""                                    {validRecipes.map(r => {
                                      const isPrimary = r.productName === d.product;
                                      return (
                                        <div key={r.productName} className="inline-flex items-center gap-2 rounded-xl bg-white border border-zinc-200 px-3.5 py-2 hover:border-zinc-400 hover:shadow-sm transition-all">
                                          <span className="text-[13px] font-medium text-zinc-900">{r.productName}</span>
                                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${"""
new = r"""                                    {validRecipes.map(r => (
                                      <div key={r.productName} className="inline-flex items-center rounded-xl bg-white border border-zinc-200 px-3.5 py-2 hover:border-zinc-400 hover:shadow-sm transition-all">
                                        <span className="text-[13px] font-medium text-zinc-900">{r.productName}</span>
                                      </div>
                                    ))"""

if old in content:
    # Find the end of the badge span to remove it all
    start = content.index(old)
    # Find the end of this block - look for `)});` or `);\n})()}`
    end_marker = "                                    }))\n"
    rest_start = content.index("                                  </div>\n                                );\n                            })()", start)
    # Go forward from the old match to find where the badge section closes
    after_badge = rest_start
    
    # Find the next line after `);` that contains `}))` 
    # Actually, let's just do a simpler approach - find and replace the whole block
    block_start = start
    # The block ends at the `;` after the .map() inside the IIFE
    # Looking at: `})}` then `;` then `})()}`
    
    # Find the closing of the map
    map_close_pos = content.find("                                  </div>\n                                );\n                              })()", start)
    if map_close_pos >= 0:
        block_end = map_close_pos + len("                                  </div>\n                                );\n                              })()")
        
        full_replacement = new
        
        # But we need to preserve the closing structure
        # The old block is: validRecipes.map(r => { ... }); })()
        # The new block should be: validRecipes.map(r => ( ... )) })()
        # Wait, the closing })() is outside the .map() 
        
        # Original structure inside return:
        # return (
        #   <div className="flex flex-wrap gap-3">
        #     {validRecipes.map(r => { ... })}
        #   </div>
        # );
        # Then later: })() closes the arrow fn body, IIFE grouping, and call
        
        # So the old block:
        # {validRecipes.map(r => { const isPrimary = ...; return (...); })}
        # 
        # New:
        # {validRecipes.map(r => (...))}
        # 
        # The closing })() is NOT part of the .map() - it's the IIFE closing.
        
        # Let me find just the segment to replace
        old_block = content[block_start:map_close_pos]
        
        # Check what comes after map_close_pos
        after_close = content[map_close_pos:map_close_pos+20]
        
        # The `;` after `)` in the old code closes the return statement, then `}` closes .map() callback, then `)` closes .map()
        # Then later: `;` closes the full statement, `}` closes arrow fn body, `)` closes IIFE grouping, `()` calls
        
        # Actually, let me just do a more precise match
        pass
else:
    print("Pattern 1 not found, trying exact match...")
    # Let's search for the key parts
    for line in content.split('\n'):
        if 'const isPrimary = r.productName === d.product;' in line:
            print(f"Found isPrimary at: {line[:60]}...")
        if 'Primary' in line and 'Linked' in line:
            print(f"Found badge: {line[:80]}...")

# Let me try a different approach - find by larger block
marker = "const isPrimary = r.productName === d.product;"
if marker in content:
    idx = content.index(marker)
    # Find start of this .map()
    # Go backwards to find `{validRecipes`
    map_start = content.rfind("{validRecipes.map", 0, idx)
    # Find end of .map() - look for `})` or `});` after the badge spans
    # Go forward to find the closing of .map()
    # Look for the pattern indicating the badge span end
    badge_end_markers = ["Primary", "Linked"]
    
    # Find the badge span end
    span_end_idx = content.find("</span>", idx)
    if span_end_idx >= 0:
        # Find the closing of the .map() - look for `)})` or `)});`
        div_close = content.find("</div>", span_end_idx + 10)
        if div_close >= 0:
            after_div = div_close + len("</div>")
            # The .map() should close soon after with `)`
            map_close = content.find(")})", after_div)
            # Or `)}` followed by the IIFE closing
            if map_close >= 0 and map_close - after_div < 50:
                # Build replacement
                new_block = (
                    '{validRecipes.map(r => (\n'
                    '                                      <div key={r.productName} className="inline-flex items-center rounded-xl bg-white border border-zinc-200 px-3.5 py-2 hover:border-zinc-400 hover:shadow-sm transition-all">\n'
                    '                                        <span className="text-[13px] font-medium text-zinc-900">{r.productName}</span>\n'
                    '                                      </div>\n'
                    '                                    ))}'
                )
                content = content[:map_start] + new_block + content[map_close + 3:]
                
                with open(r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx", "w", encoding="utf-8") as f:
                    f.write(content)
                print("Done - badges removed!")
            else:
                print(f"map_close not found or too far. map_close={map_close}, after_div={after_div}")
else:
    print("Mark not found in file")
