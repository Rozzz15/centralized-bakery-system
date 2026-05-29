import { useEffect, useState } from "react";
import type { ProductionTask, Delivery, DOSItem, VerificationResult, BranchBatch, DeliveryReport, KitchenFeedback } from "../types";
import * as db from "../lib/db";

type Props = {
  production: ProductionTask[];
  deliveries: Delivery[];
  dosItems: DOSItem[];
  onUpdateDeliveries: (deliveries: Delivery[]) => void;
  activeTab: string;
};

const steps = [
  { id: "receive", label: "Receive" },
  { id: "verify", label: "Verify" },
  { id: "batches", label: "Batches" },
  { id: "package", label: "Package" },
  { id: "report", label: "Report" },
  { id: "submit", label: "Submit" },
  { id: "feedback", label: "Feedback" },
];

export default function KitchenDashboard({ production, deliveries, dosItems, onUpdateDeliveries, activeTab }: Props) {
  const stepFromTab: Record<string, number> = { queue: 0, qc: 1, dashboard: 2 };
  const [step, setStep] = useState(stepFromTab[activeTab] ?? 2);
  const [verifications, setVerifications] = useState<VerificationResult[]>([]);
  const [batches, setBatches] = useState<BranchBatch[]>([]);
  const [reports, setReports] = useState<DeliveryReport[]>([]);
  const [feedback, setFeedback] = useState<KitchenFeedback[]>([]);

  useEffect(() => {
    Promise.all([
      db.fetchVerificationResults().then(setVerifications).catch(() => {}),
      db.fetchBranchBatches().then(setBatches).catch(() => {}),
      db.fetchDeliveryReports().then(setReports).catch(() => {}),
      db.fetchKitchenFeedback().then(setFeedback).catch(() => {}),
    ]);
  }, []);

  const completedTasks = production.filter(t => t.status === "completed");
  const verifiedTasks = verifications.filter(v => v.status === "verified");
  const pendingVerification = completedTasks.filter(t => !verifications.some(v => v.taskId === t.id));
  const rejectedTasks = verifications.filter(v => v.status === "rejected");

  function getDOSRatio(product: string) {
    const dos = dosItems.find(d => d.product === product);
    if (!dos || (dos.branch1 === 0 && dos.branch2 === 0)) return null;
    return { branch1: dos.branch1, branch2: dos.branch2, total: dos.qty };
  }

  function splitByDOS(product: string, passedQty: number) {
    const ratio = getDOSRatio(product);
    if (!ratio) return { b1: Math.floor(passedQty / 2), b2: Math.ceil(passedQty / 2) };
    const b1 = Math.round(passedQty * (ratio.branch1 / ratio.total));
    return { b1, b2: passedQty - b1 };
  }

  const handleVerify = (task: ProductionTask, qtyReceived: number, qtyRejected: number, qualityOk: boolean, consistencyOk: boolean, notes: string) => {
    const passed = Math.max(0, qtyReceived - qtyRejected);
    const newVer: VerificationResult = { taskId: task.id, product: task.product, source: task.assignedTo, qtyReceived, qtyPassed: passed, qtyRejected, qualityOk, consistencyOk, notes, status: qualityOk && consistencyOk && qtyRejected === 0 ? "verified" : "rejected" };
    setVerifications(prev => {
      const updated = [...prev, newVer];
      db.replaceVerificationResults(updated).catch(console.error);
      return updated;
    });
  };

  const handleCreateBatches = () => {
    if (verifiedTasks.length === 0) return;
    const ts = Date.now();
    const itemsB1: { product: string; qty: number; source?: string }[] = [];
    const itemsB2: { product: string; qty: number; source?: string }[] = [];
    verifiedTasks.forEach(v => {
      const { b1, b2 } = splitByDOS(v.product, v.qtyPassed);
      if (b1 > 0) itemsB1.push({ product: v.product, qty: b1, source: v.source });
      if (b2 > 0) itemsB2.push({ product: v.product, qty: b2, source: v.source });
    });
    const newBatches: BranchBatch[] = [];
    if (itemsB1.length > 0) newBatches.push({ id: `BATCH-${ts}-1`, branch: "Cakes N Styles Gensan", items: itemsB1, status: "consolidating" });
    if (itemsB2.length > 0) newBatches.push({ id: `BATCH-${ts}-2`, branch: "Shadrach's Bake & Brew", items: itemsB2, status: "consolidating" });
    setBatches(prev => {
      const updated = [...prev, ...newBatches];
      db.replaceBranchBatches(updated).catch(console.error);
      return updated;
    });
  };

  const handlePackage = (batchId: string) => {
    setBatches(prev => {
      const updated = prev.map(b => b.id === batchId ? { ...b, status: "packaged" as const } : b);
      db.replaceBranchBatches(updated).catch(console.error);
      return updated;
    });
  };

  const handleCreateReport = (batch: BranchBatch) => {
    const ts = Date.now();
    const newReport: DeliveryReport = { id: `DR-${ts}`, batchId: batch.id, branch: batch.branch, items: [...batch.items], createdAt: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }), status: "draft", totalOutput: batch.items.reduce((s, i) => s + i.qty, 0), batchRef: batch.id };
    setReports(prev => {
      const updated = [...prev, newReport];
      db.replaceDeliveryReports(updated).catch(console.error);
      return updated;
    });
  };

  const handleSubmitReport = (report: DeliveryReport) => {
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: "submitted" as const } : r));
    setBatches(prev => prev.map(b => b.id === report.batchId ? { ...b, status: "dispatched" as const } : b));
    const newDelivery: Delivery = { id: `DLV-${Date.now()}`, branch: report.branch, address: "", contactNumber: "", assignedRider: "", items: report.items, status: "preparing", eta: new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }), paymentStatus: "unpaid", notes: "" };
    const updatedDeliveries = [...deliveries, newDelivery];
    onUpdateDeliveries(updatedDeliveries);
    db.upsertDeliveries(updatedDeliveries).catch(console.error);
  };

  const handleAddFeedback = (product: string, issue: string, severity: "minor" | "major" | "critical") => {
    if (!issue.trim()) return;
    const newFb: KitchenFeedback = { id: `FB-${Date.now()}`, product, issue, severity, reportedAt: new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }), resolved: false };
    setFeedback(prev => {
      const updated = [...prev, newFb];
      db.replaceKitchenFeedback(updated).catch(console.error);
      return updated;
    });
  };
  const handleResolveFeedback = (id: string) => {
    setFeedback(prev => {
      const updated = prev.map(f => f.id === id ? { ...f, resolved: true } : f);
      db.replaceKitchenFeedback(updated).catch(console.error);
      return updated;
    });
  };

  const totalPassed = verifiedTasks.reduce((s, v) => s + v.qtyPassed, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Kitchen Dispatch</h1>
        <p className="mt-1 text-[13px] text-zinc-500">Receive production, verify quality, and dispatch to branches.</p>
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <button key={s.id} onClick={() => setStep(i)} className={`flex items-center gap-2.5 rounded-full px-5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-all ${i === step ? "bg-zinc-900 text-white shadow-sm" : i < step ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>
            <span className={`grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold ${i === step ? "bg-white/20" : i < step ? "bg-emerald-600 text-white" : "bg-zinc-300 text-white"}`}>{i < step ? "✓" : i + 1}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="rounded-[24px] border border-[#E8E0D5] bg-white p-6 shadow-sm">
        {/* Step 0: Receive */}
        {step === 0 && (
          <div>
            <h2 className="text-[21px] font-semibold">Receive Production</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Completed outputs from Baker and Deco waiting for you.</p>
            {completedTasks.length === 0 ? (
              <div className="mt-8 text-center py-8"><p className="text-[14px] text-zinc-400">No completed production yet.</p><p className="text-[12px] text-zinc-400 mt-1">Baker and Deco will send items here when done.</p></div>
            ) : (
              <div className="mt-4 space-y-2">
                {completedTasks.map(task => {
                  const ver = verifications.find(v => v.taskId === task.id);
                  const dosSplit = getDOSRatio(task.product);
                  return (
                    <div key={task.id} className={`rounded-2xl border p-4 ${ver?.status === "verified" ? "border-emerald-200 bg-emerald-50/50" : ver?.status === "rejected" ? "border-red-200 bg-red-50/50" : "border-zinc-200"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-medium">{task.product}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${task.assignedTo === "deco" ? "bg-rose-500" : "bg-stone-500"}`}>{task.assignedTo}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{task.completed}/{task.target} pcs</span>
                          {ver ? <span className={`text-[11px] font-medium ${ver.status === "verified" ? "text-emerald-600" : "text-red-600"}`}>{ver.status === "verified" ? "✓ Verified" : "✕ Rejected"}</span> : <span className="text-[11px] text-amber-600 font-medium">Pending</span>}
                        </div>
                      </div>
                      {dosSplit && <div className="mt-1 text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>DOS split: B1 {dosSplit.branch1} / B2 {dosSplit.branch2}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 1: Verify */}
        {step === 1 && (
          <div>
            <div className="flex items-center justify-between">
              <div><h2 className="text-[21px] font-semibold">Quality Check</h2><p className="mt-1 text-[13px] text-zinc-500">3-layer verification — quantity, quality, and consistency.</p></div>
              <div className="flex gap-1.5">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200">{verifiedTasks.length} passed</span>
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 border border-red-200">{rejectedTasks.length} rejected</span>
              </div>
            </div>

            {pendingVerification.length === 0 && verifiedTasks.length === 0 ? (
              <div className="mt-8 text-center py-8"><p className="text-[14px] text-zinc-400">Nothing to verify yet.</p><p className="text-[12px] text-zinc-400 mt-1">Receive production first.</p></div>
            ) : (
              <div className="mt-4 space-y-3">
                {pendingVerification.map(task => <VerificationCard key={task.id} task={task} dosItems={dosItems} onVerify={handleVerify} />)}
                {verifiedTasks.map(v => (
                  <div key={v.taskId} className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-medium text-zinc-900">{v.product}</span>
                      <span className="text-[12px] text-emerald-600 font-medium">✓ {v.qtyPassed} pcs passed</span>
                    </div>
                    {v.notes && <div className="text-[12px] text-zinc-500 mt-0.5">{v.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Batches */}
        {step === 2 && (
          <div>
            <h2 className="text-[21px] font-semibold">Create Branch Batches</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Split verified items per DOS branch ratio.</p>
            {verifiedTasks.length === 0 ? (
              <div className="mt-8 text-center py-8"><p className="text-[14px] text-zinc-400">No verified items to consolidate.</p><p className="text-[12px] text-zinc-400 mt-1">Verify production first.</p></div>
            ) : (
              <>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-50 p-4">
                  <div><span className="text-[14px] font-medium">{totalPassed} pcs</span><span className="ml-2 text-[12px] text-zinc-500">verified across {verifiedTasks.length} product{verifiedTasks.length > 1 ? "s" : ""}</span></div>
                  <button onClick={handleCreateBatches} className="rounded-xl bg-zinc-900 px-5 py-2 text-[13px] font-medium text-white hover:bg-zinc-800">Create Batches</button>
                </div>
                {batches.map(batch => (
                  <div key={batch.id} className="mt-3 rounded-2xl border border-zinc-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-medium">{batch.branch}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase ${batch.status === "consolidating" ? "bg-amber-100 text-amber-700" : batch.status === "packaged" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{batch.status}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">{batch.items.map((item, i) => (<span key={i} className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[12px]">{item.product} x{item.qty}</span>))}</div>
                    <div className="mt-2 space-x-2">
                      {batch.status === "consolidating" && <button onClick={() => { handlePackage(batch.id); setStep(3); }} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] text-white hover:bg-zinc-800">Mark Packaged</button>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Step 3: Package */}
        {step === 3 && (
          <div>
            <h2 className="text-[21px] font-semibold">Package Batches</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Mark batches as packaged when ready.</p>
            {batches.filter(b => b.status === "consolidating").length === 0 && batches.filter(b => b.status === "packaged").length === 0 ? (
              <div className="mt-8 text-center py-8"><p className="text-[14px] text-zinc-400">No batches to package.</p><p className="text-[12px] text-zinc-400 mt-1">Create batches first.</p></div>
            ) : (
              <div className="mt-4 space-y-2">
                {batches.filter(b => b.status === "consolidating").map(batch => (
                  <div key={batch.id} className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-medium">{batch.branch}</span>
                      <button onClick={() => { handlePackage(batch.id); }} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] text-white hover:bg-zinc-800">Mark Packaged</button>
                    </div>
                    <div className="mt-1 text-[12px] text-zinc-500">{batch.items.length} item{batch.items.length > 1 ? "s" : ""}</div>
                  </div>
                ))}
                {batches.filter(b => b.status === "packaged").map(batch => (
                  <div key={batch.id} className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-medium">{batch.branch}</span>
                      <div className="flex items-center gap-2"><span className="text-[11px] text-blue-600 font-medium">✓ Packaged</span><button onClick={() => { handleCreateReport(batch); setStep(4); }} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] text-white hover:bg-zinc-800">Create Report</button></div>
                    </div>
                    <div className="mt-1 text-[12px] text-zinc-500">{batch.items.length} item{batch.items.length > 1 ? "s" : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Report */}
        {step === 4 && (
          <div>
            <h2 className="text-[21px] font-semibold">Delivery Reports</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Review and submit reports to Admin.</p>
            {reports.length === 0 ? (
              <div className="mt-8 text-center py-8"><p className="text-[14px] text-zinc-400">No reports yet.</p><p className="text-[12px] text-zinc-400 mt-1">Package a batch and create a report.</p></div>
            ) : (
              <div className="mt-4 space-y-3">
                {reports.map(report => (
                  <div key={report.id} className="rounded-2xl border border-zinc-200 p-4">
                    <div className="flex items-center justify-between">
                      <div><span className="text-[14px] font-medium">{report.branch}</span><span className="ml-2 text-[11px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{report.id} • {report.createdAt}</span></div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase ${report.status === "draft" ? "bg-zinc-100 text-zinc-600" : "bg-emerald-100 text-emerald-700"}`}>{report.status}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3"><span className="text-[12px] text-zinc-500">Total: <strong>{report.totalOutput} pcs</strong></span><span className="text-[12px] text-zinc-500">Batch: <strong>{report.batchRef}</strong></span></div>
                    {report.items.length > 0 && (
                      <div className="mt-2 overflow-x-auto rounded-lg bg-zinc-50 p-2.5">
                        <table className="w-full text-[12px]"><thead><tr className="text-zinc-500"><th className="text-left font-medium">Product</th><th className="text-right font-medium">Qty</th></tr></thead><tbody>{report.items.map((item, i) => (<tr key={i} className="border-t border-zinc-200"><td className="py-1">{item.product}</td><td className="py-1 text-right" style={{ fontFamily: "Fragment Mono, monospace" }}>{item.qty}</td></tr>))}</tbody></table>
                      </div>
                    )}
                    {report.status === "draft" && <button onClick={() => { handleSubmitReport(report); setStep(5); }} className="mt-3 w-full rounded-xl bg-zinc-900 py-2 text-[13px] text-white hover:bg-zinc-800">Submit to Admin</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 5: Submit */}
        {step === 5 && (
          <div>
            <h2 className="text-[21px] font-semibold">Dispatches</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Submitted deliveries and their status.</p>
            {deliveries.filter(d => d.status !== "delivered").length === 0 ? (
              <div className="mt-8 text-center py-8"><p className="text-[14px] text-zinc-400">No active dispatches.</p></div>
            ) : (
              <div className="mt-4 space-y-2">
                {deliveries.filter(d => d.status !== "delivered").map(d => (
                  <div key={d.id} className="rounded-2xl border border-zinc-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-medium">{d.branch}</span>
                      <span className="text-[10px] uppercase font-medium text-zinc-600">{d.status}</span>
                    </div>
                    <div className="mt-1 text-[12px] text-zinc-500">ETA {d.eta} • {d.items.length} items</div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-[13px] text-emerald-600 font-medium text-center">✓ Submitted to Admin</p>
          </div>
        )}

        {/* Step 6: Feedback */}
        {step === 6 && (
          <div>
            <h2 className="text-[21px] font-semibold">Post-Delivery Feedback</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Report issues from the delivery run.</p>
            <div className="mt-4 rounded-2xl border border-zinc-200 p-4">
              <h4 className="text-[13px] font-medium mb-3">Report an Issue</h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <select id="fb-product" className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[12px] outline-none bg-white"><option value="">Product</option>{[...new Set([...dosItems.map(d => d.product), ...production.map(p => p.product)])].map(p => (<option key={p} value={p}>{p}</option>))}</select>
                <input id="fb-issue" placeholder="Describe the issue..." className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[12px] outline-none" />
                <select id="fb-severity" className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[12px] outline-none bg-white"><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option></select>
              </div>
              <button onClick={() => {
                const sel = document.getElementById("fb-product") as HTMLSelectElement;
                const inp = document.getElementById("fb-issue") as HTMLInputElement;
                const sev = document.getElementById("fb-severity") as HTMLSelectElement;
                if (sel && inp && sev && sel.value && inp.value.trim()) { handleAddFeedback(sel.value, inp.value, sev.value as "minor" | "major" | "critical"); inp.value = ""; }
              }} className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-[12px] text-white hover:bg-zinc-800">Submit Report</button>
            </div>
            {feedback.length > 0 && (
              <div className="mt-4 space-y-2">
                {feedback.map(f => (
                  <div key={f.id} className={`rounded-2xl border p-3 ${f.resolved ? "border-emerald-200 bg-emerald-50/30" : f.severity === "critical" ? "border-red-200 bg-red-50/50" : f.severity === "major" ? "border-amber-200 bg-amber-50/50" : "border-zinc-200"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><span className="text-[14px] font-medium">{f.product}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-medium uppercase ${f.severity === "critical" ? "bg-red-100 text-red-700" : f.severity === "major" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-700"}`}>{f.severity}</span></div>
                      <div className="flex items-center gap-2"><span className="text-[11px] text-zinc-500">{f.reportedAt}</span>{!f.resolved && <button onClick={() => handleResolveFeedback(f.id)} className="rounded-lg border border-zinc-300 px-2.5 py-1 text-[10px] text-zinc-600 hover:bg-zinc-50">Resolve</button>}{f.resolved && <span className="text-[11px] text-emerald-600 font-medium">✓ Resolved</span>}</div>
                    </div>
                    <div className="mt-0.5 text-[12px] text-zinc-600">{f.issue}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-100">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="rounded-xl border border-zinc-300 px-4 py-2 sm:px-6 sm:py-3 text-[14px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed">← Back</button>
          <div className="text-[14px] text-zinc-400">Step {step + 1} of {steps.length}</div>
          <button onClick={() => setStep(Math.min(steps.length - 1, step + 1))} disabled={step === steps.length - 1} className="rounded-xl bg-zinc-900 px-4 py-2 sm:px-6 sm:py-3 text-[14px] font-medium text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed">Next →</button>
        </div>
      </div>
    </div>
  );
}

function VerificationCard({ task, dosItems, onVerify }: { task: ProductionTask; dosItems: DOSItem[]; onVerify: (task: ProductionTask, qtyReceived: number, qtyRejected: number, qualityOk: boolean, consistencyOk: boolean, notes: string) => void }) {
  const [qtyReceived, setQtyReceived] = useState(task.completed);
  const [qtyRejected, setQtyRejected] = useState(0);
  const [qualityOk, setQualityOk] = useState(true);
  const [consistencyOk, setConsistencyOk] = useState(true);
  const [notes, setNotes] = useState("");
  const dosRef = dosItems.find(d => d.product === task.product);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-zinc-900">{task.product}</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">{task.assignedTo}</span>
        </div>
        <span className="text-[12px] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>DOS: {dosRef ? `${dosRef.branch1} / ${dosRef.branch2}` : `${task.target} pcs`}</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div><label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Received</label><input type="number" min="0" value={qtyReceived} onChange={e => setQtyReceived(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[12px] outline-none" style={{ fontFamily: "Fragment Mono, monospace" }} /></div>
        <div><label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Rejected</label><input type="number" min="0" value={qtyRejected} onChange={e => setQtyRejected(Math.min(Number(e.target.value), qtyReceived))} className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[12px] outline-none" style={{ fontFamily: "Fragment Mono, monospace" }} /></div>
        <div><label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Passed</label><div className="mt-1 flex h-[34px] items-center rounded-lg bg-emerald-50 px-2.5 text-[13px] font-medium text-emerald-700" style={{ fontFamily: "Fragment Mono, monospace" }}>{Math.max(0, qtyReceived - qtyRejected)} pcs</div></div>
      </div>
      <div className="mt-3 flex gap-4">
        <label className="flex items-center gap-1.5 text-[12px] text-zinc-700"><input type="checkbox" checked={qualityOk} onChange={e => setQualityOk(e.target.checked)} className="rounded border-zinc-300" /> Quality OK</label>
        <label className="flex items-center gap-1.5 text-[12px] text-zinc-700"><input type="checkbox" checked={consistencyOk} onChange={e => setConsistencyOk(e.target.checked)} className="rounded border-zinc-300" /> Consistency OK</label>
      </div>
      <div className="mt-2"><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[12px] outline-none" /></div>
      <button onClick={() => onVerify(task, qtyReceived, qtyRejected, qualityOk, consistencyOk, notes)} disabled={qtyReceived <= 0} className="mt-3 w-full rounded-xl bg-zinc-900 py-2 text-[12px] font-medium text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed">
        {qualityOk && consistencyOk && qtyRejected === 0 ? "✓ Accept & Verify" : "⚠ Report to Admin"}
      </button>
    </div>
  );
}