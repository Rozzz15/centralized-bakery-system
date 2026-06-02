import re

with open("src/components/DecoDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# The problem: the IIFE closing is:
#   );
# })()}
# But it should be:
#   );
#   });
# })()}
# Because the arrow function body needs to close, and the .map() call needs to close.

# Find the pattern: "});\n                              })()}" 
# Currently it's ");\n                              })()}" (missing the } to close .map() callback
# Wait, the current code is:
#   );
# })()}
# 
# The ); closes return ( ... ).
# The }) closes .map(r => { callback } and .map() ).
# But then () calls the IIFE - but the arrow function body {(() => { hasn't been closed!
# 
# So we need to add a } and ) between the ) of .map() and the () of IIFE call.
# 
# Current: ;\n  })()}
# Need:    ;\n  });\n})()}
# 
# Wait, the } in }) already closes the .map() callback. Then ) closes .map() call.
# But the arrow function body also needs to close.
# 
# Let me look at this more carefully.
# The structure:
# {(() => {                    <- JSX {, IIFE (, arrow function params (, arrow function body {
#   return validRecipes.map(r => {    <- .map() callback body {
#     return ( ... );
#   });                           <- close .map() callback }, close .map() call )
# })()                              <- close arrow fn body }, close IIFE ), call ()
# }                                 <- close JSX }
#
# So after ); (close return + ;), we need:
#   }   <- close .map() callback body
#   )   <- close .map() call
#   ;   <- end statement (optional)
#   }   <- close arrow function body
#   )   <- close IIFE grouping
#   ()  <- call IIFE
#   }   <- close JSX

# Fix: replace ");\n                              })()}" with ");\n                            });\n                              })()}"

# Actually, the current code has:
#                                 );
#                               })()}
# 
# Need to change to:
#                                 );
#                               });
#                             })()}

# The specific fix: change `\n                              })()}` 
# to `\n                              });\n                            })()}`

# Find the exact text
old_text = "                                );\n                              })()}"
new_text = "                                );\n                              });\n                            })()}"
if old_text in content:
    content = content.replace(old_text, new_text, 1)
    with open("src/components/DecoDashboard.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Fixed IIFE closure - added missing } to close arrow function body and ) to close IIFE grouping.")
else:
    print("ERROR: Could not find the exact pattern. Let me search...")
    idx = content.find("                                );")
    if idx >= 0:
        context = content[idx:idx+120]
        print(f"  - Found at index {idx}")
        print(f"  - Context:\n{context}")
    else:
        print("  - Could not find pattern")
