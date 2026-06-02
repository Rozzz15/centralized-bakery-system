import re

with open("src/components/DecoDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# The current state after the first script ran has:
#   return (...);
#   });
# })()}
# 
# The }); after ); is extraneous because the .map() is now inside the return ( <div> ... </div> ).
# We need to remove the extra }); line.
# 
# So the closing should be:
#   return (...);
# })()}
#
# Where:
#   ); = close return ( ... )
#   }) = close arrow function body } + IIFE grouping )
#   () = call IIFE
#   } = close JSX expression

old = "                                );\n                              });\n                            })()}"
new = "                                );\n                            })()}"

if old in content:
    content = content.replace(old, new, 1)
    with open("src/components/DecoDashboard.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Fixed closing - removed extra }); line.")
else:
    print("ERROR: Could not find the exact pattern.")
    # Find alternative patterns
    patterns = [
        "                                );\n                              });",
        "                                );\n                              });\n",
        ");\n                              });\n                            })()}",
    ]
    for p in patterns:
        if p in content:
            print(f"  - Found alternative pattern: {repr(p[:50])}")
            idx = content.index(p)
            print(f"    At index {idx}, context: {repr(content[idx:idx+80])}")
        else:
            print(f"  - NOT found: {repr(p[:50])}")
