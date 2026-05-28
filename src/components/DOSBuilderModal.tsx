import { useState } from "react";
import type { DOSItem, ProductionTask } from "../types";

type Props = {
  onClose: () => void;
  onSave: (items: DOSItem[], tasks: ProductionTask[]) => void;
  productCatalog: string[];
  onAddToCatalog: (name: string) => void;
  hasTodayItems?: boolean;
  presetDate?: string;
  scheduledDates?: Set<string>;
};

const assignRoles = [
  { id: "baker" as const, label: "Baker", color: "from-stone-600 to-neutral-700" },
  { id: "deco" as const, label: "Deco", color: "from-rose-600 to-pink-600" },
];

type Row = { product: string; qty: number; branch1: number; branch2: number };

function defaultRow(): Row {
  return { product: "", qty: 0, branch1: 0, branch2: 0 };
}

export default function DOSBuilderModal({ onClose, onSave, productCatalog, onAddToCatalog, hasTodayItems, presetDate, scheduledDates }: Props) {
  const [rows, setRows] = useState<Row[]>([defaultRow()]);
  const [selectedRoles, setSelectedRoles] = useState<Set<"baker" | "deco">>(new Set(["baker"]));
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [newProductName, setNewProductName] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const todayStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
  const defaultDate = presetDate || (hasTodayItems ? (() => { const t = new Date(); t.setDate(t.getDate() + 1); return t.toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0]; })() : todayStr);
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const isFuture = scheduledDate > todayStr;
  const dayAfterStr = (() => { const t = new Date(); t.setDate(t.getDate() + 2); return t.toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0]; })();
  const tomorrowStr = (() => { const t = new Date(); t.setDate(t.getDate() + 1); return t.toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0]; })();

  const toggleRole = (role: "baker" | "deco") => {
    setSelectedRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const updateRow = (index: number, field: keyof Row, value: string | number) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== index) return r;
      const val = field === "product" ? String(value) : (value === "" ? 0 : Number(value));
      const updated = { ...r, [field]: val };
      if (field === "branch1") updated.qty = Number(val) + r.branch2;
      if (field === "branch2") updated.qty = r.branch1 + Number(val);
      return updated;
    }));
  };

  const addRow = () => setRows(prev => [...prev, defaultRow()]);

  const removeRow = (index: number) => setRows(prev => prev.filter((_, i) => i !== index));

  const validRows = rows.filter(r => r.product.trim() && r.qty > 0);
  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);
  const totalBranch1 = rows.reduce((sum, r) => sum + r.branch1, 0);
  const totalBranch2 = rows.reduce((sum, r) => sum + r.branch2, 0);

  const isDateOccupied = (d: string) => !presetDate && ((hasTodayItems && d === todayStr) || (scheduledDates?.has(d) ?? false));
  const dateUnavailable = isDateOccupied(scheduledDate);

  const handleCreate = () => {
    if (validRows.length === 0 || selectedRoles.size === 0 || dateUnavailable) return;
    const ts = Date.now();
    const dosId = `DOS-${ts}`;
    const items: DOSItem[] = validRows.map((r, i) => ({
      id: `${dosId}-${i}`,
      product: r.product,
      qty: r.qty,
      branch1: r.branch1,
      branch2: r.branch2,
      priority,
      status: isFuture ? "scheduled" : "pending",
      scheduledDate: isFuture ? scheduledDate : undefined,
    }));
    const taskMap = new Map<string, { product: string; target: number; assignedTo: string }>();
    validRows.forEach(r => {
      [...selectedRoles].forEach(role => {
        const key = `${r.product}|${role}`;
        if (taskMap.has(key)) {
          taskMap.get(key)!.target += r.qty;
        } else {
          taskMap.set(key, { product: r.product, target: r.qty, assignedTo: role });
        }
      });
    });
    const tasks: ProductionTask[] = [...taskMap.entries()].map(([key, val], i) => ({
      id: `PRD-${ts}-${i}`,
      product: val.product,
      target: val.target,
      completed: 0,
      assignedTo: val.assignedTo as "baker" | "deco" | "kitchen",
      status: "pending" as const,
    }));
    onSave(items, tasks);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[780px] rounded-[28px] border border-[#E8E0D5] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[22px] font-semibold">New DOS</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Create a new Daily Order Sales sheet</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">✕</button>
        </div>

        <div className="mt-6 space-y-5">
          {/* Configuration row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">Production Team</label>
              <div className="flex gap-2">
                {assignRoles.map(role => {
                  const on = selectedRoles.has(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleRole(role.id)}
                      className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-all flex-1 justify-center ${
                        on
                          ? `bg-gradient-to-br ${role.color} text-white border-transparent shadow-sm`
                          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                      }`}
                    >
                      <span className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] font-bold transition-all ${
                        on ? "border-white/40 bg-white/20" : "border-zinc-300"
                      }`}>
                        {on ? "✓" : ""}
                      </span>
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as typeof priority)} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-zinc-900">
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="LOW">Low Priority</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">Schedule Date</label>
              {presetDate ? (
                <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-[13px] font-medium text-blue-800">
                  <span>📅</span>
                  <span>{new Date(presetDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</span>
                </div>
              ) : (
                <>
                  <input type="date" value={scheduledDate} min={todayStr} onChange={e => { const v = e.target.value; if (!isDateOccupied(v)) setScheduledDate(v); }} className={`w-full rounded-xl border bg-white px-3 py-2.5 text-[13px] outline-none focus:border-zinc-900 ${dateUnavailable ? 'border-red-300 text-red-600' : 'border-zinc-200'}`} />
                  {dateUnavailable && <p className="mt-1 text-[11px] text-red-500">Date unavailable — already has DOS items</p>}
                  <div className="flex gap-1.5 mt-1.5">
                    {!hasTodayItems && !scheduledDates?.has(todayStr) && <button type="button" onClick={() => setScheduledDate(todayStr)} className={`flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${scheduledDate === todayStr ? 'bg-zinc-900 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>Today</button>}
                    {!scheduledDates?.has(tomorrowStr) && <button type="button" onClick={() => setScheduledDate(tomorrowStr)} className={`flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${scheduledDate === tomorrowStr ? 'bg-blue-600 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>Tomorrow</button>}
                    {!scheduledDates?.has(dayAfterStr) && <button type="button" onClick={() => setScheduledDate(dayAfterStr)} className={`flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${scheduledDate === dayAfterStr ? 'bg-blue-600 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>Day After</button>}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Products table */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200">
            <div className="overflow-x-auto">
              <div className="min-w-[500px]">
                <div className="grid grid-cols-12 gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
              <div className="col-span-4">Product</div>
              <div className="col-span-2 text-right">Total Qty</div>
              <div className="col-span-2 text-right">Branch 1</div>
              <div className="col-span-2 text-right">Branch 2</div>
              <div className="col-span-1" />
              <div className="col-span-1" />
            </div>
            <div className="divide-y divide-zinc-100">
              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                  <div className="col-span-4">
                    {addingNew ? (
                      <div className="flex gap-1.5">
                        <input value={newProductName} onChange={e => setNewProductName(e.target.value)} placeholder="New product name" className="flex-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-zinc-400" autoFocus />
                        <button onClick={() => { if (newProductName.trim()) { onAddToCatalog(newProductName.trim()); updateRow(i, "product", newProductName.trim()); setNewProductName(""); setAddingNew(false); } }} className="rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-zinc-800">Add</button>
                        <button onClick={() => { setNewProductName(""); setAddingNew(false); }} className="rounded-lg border border-zinc-200 px-2 py-1.5 text-[12px] text-zinc-500 hover:bg-zinc-50">✕</button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <select value={row.product} onChange={e => { if (e.target.value === "__new__") { setAddingNew(true); } else { updateRow(i, "product", e.target.value); } }} className="flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-zinc-400">
                          <option value="">Select product…</option>
                          {productCatalog.map(p => <option key={p} value={p}>{p}</option>)}
                          <option value="__new__">+ New product…</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={row.qty || ""}
                      readOnly
                      placeholder="0"
                      className="w-full rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 text-[13px] text-right text-zinc-500 outline-none placeholder:text-zinc-300"
                      style={{ fontFamily: "Fragment Mono, monospace" }}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      value={row.branch1 || ""}
                      placeholder="0"
                      onChange={e => updateRow(i, "branch1", e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] text-right outline-none focus:border-zinc-400 placeholder:text-zinc-300"
                      style={{ fontFamily: "Fragment Mono, monospace" }}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      value={row.branch2 || ""}
                      placeholder="0"
                      onChange={e => updateRow(i, "branch2", e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] text-right outline-none focus:border-zinc-400 placeholder:text-zinc-300"
                      style={{ fontFamily: "Fragment Mono, monospace" }}
                    />
                  </div>
                  <div className="col-span-1" />
                  <div className="col-span-1 text-right">
                    {rows.length > 1 && (
                      <button onClick={() => removeRow(i)} className="text-[14px] text-zinc-400 hover:text-red-500">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
            <button onClick={addRow} className="flex w-full items-center justify-center gap-1.5 border-t border-dashed border-zinc-200 px-3 py-2.5 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-all">
              + Add another product
            </button>
          </div>

          {/* Summary */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-4 text-[12px] text-zinc-600">
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400 font-medium">Items</span>
                <span className="font-semibold text-zinc-900">{validRows.length}</span>
              </div>
              <span className="text-zinc-200">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400 font-medium">Total</span>
                <span className="font-semibold text-zinc-900">{totalQty} pcs</span>
              </div>
              <span className="text-zinc-200">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400 font-medium">B1</span>
                <span className="font-semibold text-zinc-900">{totalBranch1}</span>
              </div>
              <span className="text-zinc-200">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400 font-medium">B2</span>
                <span className="font-semibold text-zinc-900">{totalBranch2}</span>
              </div>
              {selectedRoles.size > 0 && (
                <>
                  <span className="text-zinc-200">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-400 font-medium">Team</span>
                    <span className="font-semibold text-zinc-900">{[...selectedRoles].map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(", ")}</span>
                  </div>
                </>
              )}
              <span className="text-zinc-200">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400 font-medium">Date</span>
                <span className="font-semibold text-zinc-900">{new Date(scheduledDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                <span className={`text-[10px] font-medium ${isFuture ? "text-blue-600" : "text-amber-600"}`}>{isFuture ? "(scheduled)" : "(today)"}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button onClick={onClose} className="rounded-xl border border-zinc-300 px-4 py-2 text-[13px] font-medium hover:bg-zinc-50">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={validRows.length === 0 || selectedRoles.size === 0 || dateUnavailable}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isFuture ? "Schedule" : "Create"} DOS ({validRows.length} product{validRows.length !== 1 ? "s" : ""})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
