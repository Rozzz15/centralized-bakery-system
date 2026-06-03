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
  { id: "pastry" as const, label: "Pastry", color: "from-amber-600 to-yellow-700" },
  { id: "deco" as const, label: "Deco", color: "from-rose-600 to-pink-600" },
];

type Row = { product: string; qty: number };

function defaultRow(): Row {
  return { product: "", qty: 0 };
}

export default function DOSBuilderModal({ onClose, onSave, productCatalog, onAddToCatalog, hasTodayItems, presetDate, scheduledDates }: Props) {
  const [rows, setRows] = useState<Row[]>([defaultRow()]);
  const [selectedRoles, setSelectedRoles] = useState<Set<"baker" | "pastry" | "deco">>(new Set(["baker", "pastry", "deco"]));
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [productSearch, setProductSearch] = useState<Record<number, string>>({});
  const [showSuggestions, setShowSuggestions] = useState<Record<number, boolean>>({});
  const todayStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
  const defaultDate = presetDate || (hasTodayItems ? (() => { const t = new Date(); t.setDate(t.getDate() + 1); return t.toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0]; })() : todayStr);
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const isFuture = scheduledDate > todayStr;
  const dayAfterStr = (() => { const t = new Date(); t.setDate(t.getDate() + 2); return t.toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0]; })();
  const tomorrowStr = (() => { const t = new Date(); t.setDate(t.getDate() + 1); return t.toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0]; })();

  const toggleRole = (role: "baker" | "pastry" | "deco") => {
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
      return { ...r, [field]: val };
    }));
  };

  const addRow = () => setRows(prev => [...prev, defaultRow()]);

  const removeRow = (index: number) => setRows(prev => prev.filter((_, i) => i !== index));

  const validRows = rows.filter(r => r.product.trim() && r.qty > 0);
  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);

  const isDateOccupied = (d: string) => !presetDate && ((hasTodayItems && d === todayStr) || (scheduledDates?.has(d) ?? false));
  const dateUnavailable = isDateOccupied(scheduledDate);

  const handleCreate = () => {
    if (validRows.length === 0 || selectedRoles.size === 0 || dateUnavailable) return;
    const ts = Date.now();
    const dosId = `DOS-${ts}`;
    const items: DOSItem[] = rows.map((val, idx) => ({
      id: `DOS-${ts}-${idx}`,
      product: val.product,
      qty: val.qty,
      priority: priority,
      status: isFuture ? "scheduled" : "pending",
      scheduledDate: isFuture ? scheduledDate : undefined,
      roles: Array.from(selectedRoles),
    }));

    const tasksMap = new Map<string, { product: string; role: "baker" | "pastry" | "deco" | "kitchen"; target: number; itemIdx: number }>();
    items.forEach((item, itemIdx) => {
      [...selectedRoles].forEach((role) => {
        const key = `${item.product}|${role}`;
        if (tasksMap.has(key)) {
          tasksMap.get(key)!.target += item.qty;
        } else {
          tasksMap.set(key, { product: item.product, role: role, target: item.qty, itemIdx });
        }
      });
    });
    const tasks: ProductionTask[] = [...tasksMap.entries()].map(([key, val], idx) => ({
      id: `PRD-${ts}-${val.itemIdx}-${idx}`,
      product: val.product,
      target: val.target,
      completed: 0,
      assignedTo: val.role,
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
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2">
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
            <div className="col-span-1">
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
          <div className="rounded-2xl border border-zinc-200">
            <div className="overflow-visible">
              <div className="min-w-[500px]">
                <div className="grid grid-cols-12 gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>
              <div className="col-span-5">Product</div>
              <div className="col-span-3 text-right">Total Qty</div>
              <div className="col-span-2" />
              <div className="col-span-2" />
            </div>
            <div className="divide-y divide-zinc-100">
              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                  <div className="col-span-5 relative">
                    <input
                      value={productSearch[i] ?? row.product}
                      onChange={e => {
                        const val = e.target.value;
                        setProductSearch(prev => ({ ...prev, [i]: val }));
                        setShowSuggestions(prev => ({ ...prev, [i]: true }));
                        if (val && !productCatalog.some(p => p.toLowerCase() === val.toLowerCase())) {
                          updateRow(i, "product", "");
                        } else if (val && productCatalog.some(p => p.toLowerCase() === val.toLowerCase())) {
                          updateRow(i, "product", val);
                        }
                      }}
                      onFocus={() => setShowSuggestions(prev => ({ ...prev, [i]: true }))}
                      onBlur={() => setTimeout(() => setShowSuggestions(prev => ({ ...prev, [i]: false })), 200)}
                      placeholder="Search product…"
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-zinc-400 placeholder:text-zinc-300"
                    />
                    {showSuggestions[i] && (() => {
                      const search = (productSearch[i] ?? '').toLowerCase();
                      const filtered = search
                        ? productCatalog.filter(p => p.toLowerCase().includes(search))
                        : productCatalog;
                      const exactMatch = search && productCatalog.some(p => p.toLowerCase() === search);
                      const showNew = search && !exactMatch;
                      if (!search && filtered.length === 0) return null;
                      return (
                        <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-zinc-200 bg-white shadow-lg z-10 max-h-48 overflow-y-auto">
                          {filtered.length > 0 && filtered.map(p => (
                            <button
                              key={p}
                              onMouseDown={() => {
                                updateRow(i, "product", p);
                                setProductSearch(prev => ({ ...prev, [i]: p }));
                                setShowSuggestions(prev => ({ ...prev, [i]: false }));
                              }}
                              className={`w-full text-left px-3 py-2 text-[13px] hover:bg-zinc-50 transition-colors ${row.product === p ? 'bg-zinc-100 font-medium' : ''}`}
                            >
                              {p}
                            </button>
                          ))}
                          {showNew && (
                            <button
                              onMouseDown={() => {
                                const name = productSearch[i]!.trim();
                                if (name) {
                                  onAddToCatalog(name);
                                  updateRow(i, "product", name);
                                  setProductSearch(prev => ({ ...prev, [i]: name }));
                                  setShowSuggestions(prev => ({ ...prev, [i]: false }));
                                }
                              }}
                              className="w-full text-left px-3 py-2 text-[13px] text-blue-600 hover:bg-blue-50 transition-colors border-t border-zinc-100 font-medium"
                            >
                              + Add "{productSearch[i]}"
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      min="0"
                      value={row.qty || ""}
                      placeholder="0"
                      onChange={e => updateRow(i, "qty", e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[13px] text-right outline-none focus:border-zinc-400 placeholder:text-zinc-300"
                      style={{ fontFamily: "Fragment Mono, monospace" }}
                    />
                  </div>
                  <div className="col-span-2" />
                  <div className="col-span-2 text-right">
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
