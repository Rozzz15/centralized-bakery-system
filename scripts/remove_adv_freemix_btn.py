import re

path = r"C:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\DecoDashboard.tsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_actions = r"""                  {/* Actions */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100">
                    <button
                      onClick={() => setActiveTab("adv-freemix")}
                      className="rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-zinc-800 transition-all"
                    >
                      Prepare in Advanced Freemix →
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
                  </div>"""

new_actions = r"""                  {/* Actions */}
                  <div className="flex justify-center mt-4 pt-4 border-t border-zinc-100">
                    <button
                      onClick={() => {
                        if (isPrepped) {
                          setFreeMixDone(prev => { const n = new Set(prev); n.delete(d.product); return n; });
                        } else {
                          setFreeMixDone(prev => new Set(prev).add(d.product));
                        }
                      }}
                      className={`rounded-xl px-6 py-3 text-[14px] font-bold transition-all ${
                        isPrepped
                          ? "border-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-2 border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 hover:shadow-sm"
                      }`}
                    >
                      {isPrepped ? "Mark as Not Ready" : "Mark as Prepared"}
                    </button>
                  </div>"""

if old_actions in content:
    content = content.replace(old_actions, new_actions)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Removed 'Prepare in Advanced Freemix' button and centered 'Mark as Prepared'.")
else:
    print("ERROR: Could not find old actions section.")
    # Try to find the button
    idx = content.find("Prepare in Advanced Freemix")
    if idx >= 0:
        print(f"  Found 'Prepare in Advanced Freemix' at position {idx}")
        print(f"  Context:")
        print(repr(content[idx-500:idx+800]))
    else:
        print("  Could not find 'Prepare in Advanced Freemix' anywhere")
