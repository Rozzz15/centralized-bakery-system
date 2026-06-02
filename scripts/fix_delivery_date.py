#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Fix AdminDashboard.tsx:
# 1. Add newDeliveryDate state
# 2. Add date input to Add Delivery modal
# 3. Include createdAt in newDelivery object
# 4. Display date on delivery cards

import re

path = "src/components/AdminDashboard.tsx"

with open(path, "r", encoding="utf-8") as f:
    text = f.read()

changes = 0

# === Change 1: Add newDeliveryDate state ===
old_state = "const [newDeliveryNotes, setNewDeliveryNotes] = useState(\"\");"
new_state = "const [newDeliveryDate, setNewDeliveryDate] = useState(new Date().toISOString().split(\"T\")[0]);\n  const [newDeliveryNotes, setNewDeliveryNotes] = useState(\"\");"

if old_state in text:
    text = text.replace(old_state, new_state, 1)
    changes += 1
    print("✅ Added newDeliveryDate state")
else:
    print("❌ Could not find newDeliveryNotes state declaration")

# === Change 2: Add date input after Delivery Time section ===
# Looking at the actual text, the Delivery Time div closes with:
#               </div>
#  (blank line)
#               {/* Delivery Details */}
old_time_section_end = "              </div>\n\n              {/* Delivery Details */}"
new_time_section_end = """              </div>
            </div>

              {/* Delivery Date */}
              <div className=\"mb-4\">
                <label className=\"text-[12px] font-medium text-zinc-700 mb-1.5 block\">Delivery Date</label>
                <input type=\"date\" value={newDeliveryDate} onChange={e => setNewDeliveryDate(e.target.value)} className=\"w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[13px] focus:outline-none focus:border-zinc-400\" />
              </div>

              {/* Delivery Details */}"""

# The pattern is only the closing </div> + blank + Delivery Details
# But there's also an outer container that was already closed by </div>
# Actually looking again: the Delivery Time block is just:
# <div className="mb-4">
#   <label>Delivery Time</label>
#   <div className="flex gap-2">...</div>
# </div>
# So it's only one div that closes. But the pattern in the file has:
#               </div>
# (blank)
#               {/* Delivery Details */}
# Let me just use a simple search

if old_time_section_end in text:
    text = text.replace(old_time_section_end, new_time_section_end, 1)
    changes += 1
    print("✅ Added Delivery Date input to modal")
else:
    # Try with the outer </div>
    old_alt = "                </div>\n              </div>\n\n              {/* Delivery Details */}"
    new_alt = "                </div>\n              </div>\n\n              {/* Delivery Date */}\n              <div className=\"mb-4\">\n                <label className=\"text-[12px] font-medium text-zinc-700 mb-1.5 block\">Delivery Date</label>\n                <input type=\"date\" value={newDeliveryDate} onChange={e => setNewDeliveryDate(e.target.value)} className=\"w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-[13px] focus:outline-none focus:border-zinc-400\" />\n              </div>\n\n              {/* Delivery Details */}"
    if old_alt in text:
        text = text.replace(old_alt, new_alt, 1)
        changes += 1
        print("✅ Added Delivery Date input to modal (alt pattern)")
    else:
        print("❌ Could not find Delivery Time section end")

# === Change 3: Include createdAt in newDelivery object ===
old_notes = "notes: newDeliveryNotes.trim(),"
new_notes = "notes: newDeliveryNotes.trim(),\n          createdAt: newDeliveryDate + \"T\" + (newDeliveryEta || \"00:00\") + \":00\","

if old_notes in text:
    text = text.replace(old_notes, new_notes, 1)
    changes += 1
    print("✅ Added createdAt to newDelivery object")
else:
    print("❌ Could not find notes field in newDelivery object")

# === Change 3b: Reset newDeliveryDate when opening modal ===
old_reset = 'setNewDeliveryNotes(""); setShowAddDelivery(true);'
new_reset = 'setNewDeliveryDate(new Date().toISOString().split("T")[0]); setNewDeliveryNotes(""); setShowAddDelivery(true);'

if old_reset in text:
    text = text.replace(old_reset, new_reset, 1)
    changes += 1
    print("✅ Added newDeliveryDate reset on modal open")
else:
    print("❌ Could not find modal reset pattern")

# === Change 4: Show date on delivery cards ===
old_eta_display = '                    <span className="text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>ETA: {d.eta}</span>'
new_eta_display = '                    <span className="text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>Date: {d.createdAt ? new Date(d.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"}  •  ETA: {d.eta}</span>'

if old_eta_display in text:
    text = text.replace(old_eta_display, new_eta_display, 1)
    changes += 1
    print("✅ Added date display to delivery cards")
else:
    print("❌ Could not find ETA display line")

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print(f"\nDone! {changes} changes made.")
