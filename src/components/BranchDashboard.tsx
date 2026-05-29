type Props = {
  selectedBranch: "branch1" | "branch2";
  onBranchChange: (branch: "branch1" | "branch2") => void;
  salesAmount: string;
  onSalesAmountChange: (value: string) => void;
  onSubmitSales: () => void;
};

export default function BranchDashboard({
  selectedBranch,
  onBranchChange,
  salesAmount,
  onSalesAmountChange,
  onSubmitSales,
}: Props) {
  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Branch Portal</h1>
        <p className="mt-1 text-[13px] text-zinc-600">Receive deliveries and record daily sales.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold">Incoming Delivery</h2>
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-amber-950">DLV-101 • In Transit</div>
                <div className="text-[12px] text-amber-900/80">ETA 08:30 AM • From Kitchen</div>
              </div>
              <button className="rounded-xl bg-amber-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-amber-700 transition-all">Receive</button>
            </div>
            <div className="mt-3 space-y-1 text-[12px] text-amber-950/80">
              <div className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-amber-600" />
                Pandesal — 300 pcs
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-amber-600" />
                Loaf Bread — 120 pcs
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold">Daily Sales Entry</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-[12px] font-medium text-zinc-700">Branch</label>
              <select value={selectedBranch} onChange={e => onBranchChange(e.target.value as any)} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5">
                <option value="branch1">Cakes N Styles Gensan</option>
                <option value="branch2">Shadrach's Bake & Brew</option>
              </select>
            </div>
            <div>
              <label className="text-[12px] font-medium text-zinc-700">Sales Amount (₱)</label>
              <input
                value={salesAmount}
                onChange={e => onSalesAmountChange(e.target.value)}
                placeholder="0.00"
                className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/5"
                style={{ fontFamily: "Fragment Mono, monospace" }}
              />
            </div>
            <button
              onClick={onSubmitSales}
              disabled={!salesAmount}
              className="w-full rounded-xl bg-zinc-900 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-zinc-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit Sales Report
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-red-200 bg-red-50/80 p-4">
        <div className="flex gap-3">
          <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-100 text-[14px] text-red-700">⚠</div>
          <div>
            <div className="text-[13px] font-medium text-red-900">Limited Access</div>
            <div className="mt-0.5 text-[12px] leading-relaxed text-red-800/80">Sales entry and delivery receiving only. Inventory and production data is read-only. Contact an admin for changes.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
