import re

# ── Fix App.tsx: change production task status from "pending" to "in-progress" ──
with open('src/App.tsx', 'r', encoding='utf-8') as f:
    app = f.read()

changes_app = 0

# Demo data: PRD-4
old = '''    { id: "PRD-4", product: "Sponge Fudge", target: 40, completed: 0, assignedTo: "deco", status: "pending" },'''
new = '''    { id: "PRD-4", product: "Sponge Fudge", target: 40, completed: 0, assignedTo: "deco", status: "in-progress" },'''
if old in app:
    app = app.replace(old, new, 1)
    changes_app += 1
    print("Fixed PRD-4 demo status")
else:
    old_crlf = old.replace('\n', '\r\n')
    new_crlf = new.replace('\n', '\r\n')
    if old_crlf in app:
        app = app.replace(old_crlf, new_crlf, 1)
        changes_app += 1
        print("Fixed PRD-4 demo status (CRLF)")

# Init scheduled activation (line ~276)
old = '''            const tasks: ProductionTask[] = updated.map((item, idx) => ({ id: `PRD-${Date.now()}-${idx}`, product: item.product, target: item.qty, completed: 0, assignedTo: "baker" as const, status: "pending" as const }));'''
new = '''            const tasks: ProductionTask[] = updated.map((item, idx) => ({ id: `PRD-${Date.now()}-${idx}`, product: item.product, target: item.qty, completed: 0, assignedTo: "baker" as const, status: "in-progress" as const }));'''
if old in app:
    app = app.replace(old, new, 1)
    changes_app += 1
    print("Fixed init scheduled activation")
else:
    old_crlf = old.replace('\n', '\r\n')
    new_crlf = new.replace('\n', '\r\n')
    if old_crlf in app:
        app = app.replace(old_crlf, new_crlf, 1)
        changes_app += 1
        print("Fixed init scheduled activation (CRLF)")

# Timer effect scheduled activation (line ~345)
old = '''          const tasks: ProductionTask[] = updated.map((item, idx) => ({\n          id: `PRD-${Date.now()}-${idx}`,\n          product: item.product,\n          target: item.qty,\n          completed: 0,\n          assignedTo: \"baker\" as const,\n          status: \"pending\" as const,\n        }));'''
new = '''          const tasks: ProductionTask[] = updated.map((item, idx) => ({\n          id: `PRD-${Date.now()}-${idx}`,\n          product: item.product,\n          target: item.qty,\n          completed: 0,\n          assignedTo: \"baker\" as const,\n          status: \"in-progress\" as const,\n        }));'''
if old in app:
    app = app.replace(old, new, 1)
    changes_app += 1
    print("Fixed timer scheduled activation")
else:
    old_crlf = old.replace('\n', '\r\n')
    new_crlf = new.replace('\n', '\r\n')
    if old_crlf in app:
        app = app.replace(old_crlf, new_crlf, 1)
        changes_app += 1
        print("Fixed timer scheduled activation (CRLF)")

# handleActivateScheduled (line ~464)
old = '''      const tasks: ProductionTask[] = updated.map((item, idx) => ({ id: `PRD-${Date.now()}-${idx}`, product: item.product, target: item.qty, completed: 0, assignedTo: "baker" as const, status: "pending" as const }));'''
new = '''      const tasks: ProductionTask[] = updated.map((item, idx) => ({ id: `PRD-${Date.now()}-${idx}`, product: item.product, target: item.qty, completed: 0, assignedTo: "baker" as const, status: "in-progress" as const }));'''
if old in app:
    app = app.replace(old, new, 1)
    changes_app += 1
    print("Fixed handleActivateScheduled")
else:
    old_crlf = old.replace('\n', '\r\n')
    new_crlf = new.replace('\n', '\r\n')
    if old_crlf in app:
        app = app.replace(old_crlf, new_crlf, 1)
        changes_app += 1
        print("Fixed handleActivateScheduled (CRLF)")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(app)
print(f"App.tsx: {changes_app} changes made")


# ── Fix AdminDashboard.tsx: remove Pending Authorization section ──
with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    admin = f.read()

changes_admin = 0

# Remove pendingBaker and pendingDeco variable definitions + blank lines
old = '''    const kitchenTasks = todayTasks.filter(t => t.assignedTo === "kitchen");
    const pendingBaker = bakerTasks.filter(t => t.status === "pending");
    const pendingDeco = decoTasks.filter(t => t.status === "pending");

    return'''
new = '''    const kitchenTasks = todayTasks.filter(t => t.assignedTo === "kitchen");

    return'''
if old in admin:
    admin = admin.replace(old, new, 1)
    changes_admin += 1
    print("Removed pendingBaker/pendingDeco vars")
else:
    old_crlf = old.replace('\n', '\r\n')
    new_crlf = new.replace('\n', '\r\n')
    if old_crlf in admin:
        admin = admin.replace(old_crlf, new_crlf, 1)
        changes_admin += 1
        print("Removed pendingBaker/pendingDeco vars (CRLF)")
    else:
        print("ERROR: Could not find pendingBaker/pendingDeco vars")

# Remove the entire Pending Authorization section
# Find from the start of the section to the closing of Production History
old_section = '''        {/* Pending Authorization */}
        {(pendingBaker.length > 0 || pendingDeco.length > 0) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-amber-200/60">
              <h2 className="text-[13px] font-semibold text-amber-900">Pending Authorization</h2>
              <p className="text-[11px] text-amber-700">{pendingBaker.length + pendingDeco.length} tasks waiting to start</p>
            </div>
            <div className="divide-y divide-amber-100/60">
              {[...pendingBaker, ...pendingDeco].map(task => (
                <div key={task.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/60 transition-all">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-medium text-zinc-900 truncate">{task.product}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium text-white ${task.assignedTo === "baker" ? "bg-stone-500" : "bg-rose-500"}`}>{task.assignedTo === "baker" ? "Baker" : "Deco"}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-zinc-500 font-mono">{task.target} pcs</span>
                    <button onClick={() => onUpdateProduction(task.id, { status: "in-progress" })} className="rounded-lg bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-zinc-800">Authorize</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Production History */}'''
new_section = '''        {/* Production History */}'''
if old_section in admin:
    admin = admin.replace(old_section, new_section, 1)
    changes_admin += 1
    print("Removed Pending Authorization section")
else:
    old_section_crlf = old_section.replace('\n', '\r\n')
    new_section_crlf = new_section.replace('\n', '\r\n')
    if old_section_crlf in admin:
        admin = admin.replace(old_section_crlf, new_section_crlf, 1)
        changes_admin += 1
        print("Removed Pending Authorization section (CRLF)")
    else:
        print("ERROR: Could not find Pending Authorization section")

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(admin)
print(f"AdminDashboard.tsx: {changes_admin} changes made")
