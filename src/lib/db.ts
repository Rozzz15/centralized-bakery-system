import { supabase } from "./supabase";
import type {
  InventoryItem, DOSItem, ProductionTask, Delivery, AuditLog,
  ProductRecipe, BakerIngredientRequest, MaterialRequest,
  StockTransaction, DeliveryValidation, VerificationResult,
  BranchBatch, DeliveryReport, KitchenFeedback, DecoSubTask, DecoQCResult,
} from "../types";

function parseDOS(d: any): DOSItem {
  return { id: d.id, product: d.product, qty: d.qty, branch1: d.branch1, branch2: d.branch2, priority: d.priority, status: d.status, scheduledDate: d.scheduled_date || undefined };
}
function toDOSRow(d: DOSItem) {
  return { id: d.id, product: d.product, qty: d.qty, branch1: d.branch1, branch2: d.branch2, priority: d.priority, status: d.status, scheduled_date: d.scheduledDate || null };
}

function parseProduction(p: any): ProductionTask {
  return { id: p.id, product: p.product, target: p.target, completed: p.completed, assignedTo: p.assigned_to, status: p.status };
}
function toProductionRow(p: ProductionTask) {
  return { id: p.id, product: p.product, target: p.target, completed: p.completed, assigned_to: p.assignedTo, status: p.status };
}

function parseDelivery(d: any): Delivery {
  return { id: d.id, branch: d.branch, items: d.items ?? [], status: d.status, eta: d.eta };
}
function toDeliveryRow(d: Delivery) {
  return { id: d.id, branch: d.branch, items: d.items, status: d.status, eta: d.eta };
}

// ─── Inventory ───
// Table name mapping for separate inventory tables
const INVENTORY_TABLES: Record<string, string> = {
  "ingredients": "ingredients",
  "packaging-materials": "packaging_materials",
  "decoration-supplies": "decoration_supplies",
  "operational-supplies": "operational_supplies",
};

function parseInventoryItem(d: any, group: string): InventoryItem {
  return { id: d.id, name: d.name, sku: d.sku, unit: d.unit, onHand: d.on_hand, threshold: d.threshold, cost: d.cost, supplier: d.supplier, lastIn: d.last_in, category: d.category, group: group as InventoryItem["group"], expiryDate: d.expiry_date || undefined };
}
function toInventoryRow(i: InventoryItem) {
  return { id: i.id, name: i.name, sku: i.sku, unit: i.unit, on_hand: i.onHand, threshold: i.threshold, cost: i.cost, supplier: i.supplier, last_in: i.lastIn, category: i.category, expiry_date: i.expiryDate || null };
}

export async function fetchInventoryByGroup(group: string): Promise<InventoryItem[]> {
  const table = INVENTORY_TABLES[group];
  if (!table) return [];
  const { data, error } = await supabase.from(table).select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((d: any) => parseInventoryItem(d, group));
}

export async function fetchAllInventory(): Promise<InventoryItem[]> {
  const results = await Promise.all(
    Object.keys(INVENTORY_TABLES).map(group => fetchInventoryByGroup(group).catch(() => [] as InventoryItem[]))
  );
  return results.flat();
}

export async function upsertInventoryItem(item: InventoryItem) {
  const table = INVENTORY_TABLES[item.group];
  if (!table) throw new Error(`Unknown inventory group: ${item.group}`);
  const { error } = await supabase.from(table).upsert(toInventoryRow(item), { onConflict: "id" });
  if (error) throw error;
}

export async function upsertInventory(items: InventoryItem[]) {
  // Group items by table, then batch-upsert each table with one call
  const grouped = new Map<string, InventoryItem[]>();
  for (const item of items) {
    const table = INVENTORY_TABLES[item.group];
    if (!table) continue;
    if (!grouped.has(table)) grouped.set(table, []);
    grouped.get(table)!.push(item);
  }
  await Promise.all([...grouped.entries()].map(([table, tableItems]) =>
    supabase.from(table).upsert(tableItems.map(toInventoryRow), { onConflict: "id" }).then(r => { if (r.error) throw r.error; })
  ));
}

export async function updateInventoryItem(id: string, updates: Partial<InventoryItem>) {
  const group = updates.group;
  const table = group ? INVENTORY_TABLES[group] : null;
  if (!table) throw new Error(`Cannot update — group is required`);
  const row: any = {};
  if ("onHand" in updates) row.on_hand = updates.onHand;
  if ("name" in updates) row.name = updates.name;
  if ("sku" in updates) row.sku = updates.sku;
  if ("unit" in updates) row.unit = updates.unit;
  if ("threshold" in updates) row.threshold = updates.threshold;
  if ("cost" in updates) row.cost = updates.cost;
  if ("supplier" in updates) row.supplier = updates.supplier;
  if ("lastIn" in updates) row.last_in = updates.lastIn;
  if ("category" in updates) row.category = updates.category;
  const { error } = await supabase.from(table).update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteInventoryItem(id: string, group?: string) {
  if (group) {
    const table = INVENTORY_TABLES[group];
    if (table) {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      return;
    }
  }
  // Fallback: try all tables
  for (const table of Object.values(INVENTORY_TABLES)) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error && !error.message.includes("PGRST116")) throw error;
  }
}

// Legacy: fetch from old inventory_items table (backward compat)
export async function fetchInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase.from("inventory_items").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ id: d.id, name: d.name, sku: d.sku, unit: d.unit, onHand: d.on_hand, threshold: d.threshold, cost: d.cost, supplier: d.supplier, lastIn: d.last_in, category: d.category, group: d.group || "ingredients", expiryDate: d.expiry_date || undefined }));
}
export async function deleteDOSItem(id: string) {
  const { error } = await supabase.from("dos_items").delete().eq("id", id);
  if (error) throw error;
}

// ─── DOS ───
export async function fetchDOS(): Promise<DOSItem[]> {
  const { data, error } = await supabase.from("dos_items").select("*").order("product");
  if (error) throw error;
  return (data ?? []).map(parseDOS);
}
export async function upsertDOS(items: DOSItem[]) {
  const { error } = await supabase.from("dos_items").upsert(items.map(toDOSRow), { onConflict: "id" });
  if (error) throw error;
}
export async function updateDOS(id: string, updates: Partial<DOSItem>) {
  const row: any = {};
  if ("status" in updates) row.status = updates.status;
  if ("priority" in updates) row.priority = updates.priority;
  if ("scheduledDate" in updates) row.scheduled_date = updates.scheduledDate || null;
  const { error } = await supabase.from("dos_items").update(row).eq("id", id);
  if (error) throw error;
}

// ─── Production ───
export async function fetchProduction(): Promise<ProductionTask[]> {
  const { data, error } = await supabase.from("production_tasks").select("*").order("product");
  if (error) throw error;
  return (data ?? []).map(parseProduction);
}
export async function upsertProduction(tasks: ProductionTask[]) {
  const { error } = await supabase.from("production_tasks").upsert(tasks.map(toProductionRow), { onConflict: "id" });
  if (error) throw error;
}
export async function updateProduction(id: string, updates: Partial<ProductionTask>) {
  const row: any = {};
  if ("completed" in updates) row.completed = updates.completed;
  if ("status" in updates) row.status = updates.status;
  const { error } = await supabase.from("production_tasks").update(row).eq("id", id);
  if (error) throw error;
}

// ─── Deliveries ───
export async function fetchDeliveries(): Promise<Delivery[]> {
  const { data, error } = await supabase.from("deliveries").select("*").order("id");
  if (error) throw error;
  return (data ?? []).map(parseDelivery);
}
export async function upsertDeliveries(items: Delivery[]) {
  const { error } = await supabase.from("deliveries").upsert(items.map(toDeliveryRow), { onConflict: "id" });
  if (error) throw error;
}

// ─── Audit Logs ───
export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase.from("audit_logs").select("*").order("id", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ id: d.id, timestamp: d.timestamp, user: d.user, role: d.role, action: d.action, details: d.details }));
}

export async function clearAuditLogs(): Promise<void> {
  await supabase.from("audit_logs").delete().neq("id", ""); // wipe all old demo entries
}

export async function addAuditLog(log: Omit<AuditLog, "id">): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    id: crypto.randomUUID(),
    timestamp: log.timestamp,
    user: log.user,
    role: log.role,
    action: log.action,
    details: log.details,
  });
  if (error) console.error("audit log error:", error);
}

// ─── Product Catalog ───
export async function fetchProductCatalog(): Promise<string[]> {
  const { data, error } = await supabase.from("product_catalog").select("name").order("name");
  if (error) throw error;
  return (data ?? []).map((r: any) => r.name);
}
export async function addToCatalog(name: string) {
  const { error } = await supabase.from("product_catalog").insert({ name }).maybeSingle();
  if (error && !error.message.includes("duplicate")) throw error;
}

// ─── Recipes ───
export async function fetchRecipes(): Promise<ProductRecipe[]> {
  const { data, error } = await supabase.from("product_recipes").select("*");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    productId: r.product_id,
    productName: r.product_name,
    ingredients: r.ingredients ?? [],
    packagingMaterials: r.packaging_materials ?? [],
    decorationSupplies: r.decoration_supplies ?? [],
  }));
}
export async function upsertRecipe(recipe: ProductRecipe) {
  const { error } = await supabase.from("product_recipes").upsert({
    product_id: recipe.productId,
    product_name: recipe.productName,
    ingredients: recipe.ingredients,
    packaging_materials: recipe.packagingMaterials ?? [],
    decoration_supplies: recipe.decorationSupplies ?? [],
  }, { onConflict: "product_id" });
  if (error) {
    const fallback = await supabase.from("product_recipes").upsert({
      product_id: recipe.productId,
      product_name: recipe.productName,
      ingredients: recipe.ingredients,
    }, { onConflict: "product_id" });
    if (fallback.error) console.error("recipe upsert failed:", fallback.error);
  }
}

// ─── Stock Transactions ───
export async function fetchStockTransactions(): Promise<StockTransaction[]> {
  const { data, error } = await supabase.from("stock_transactions").select("*").order("timestamp", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    id: d.id, type: d.type, itemName: d.item_name, itemId: d.item_id,
    qty: d.qty, unit: d.unit, reference: d.reference, timestamp: d.timestamp, target: d.target,
  }));
}
export async function insertStockTransaction(tx: StockTransaction) {
  const { error } = await supabase.from("stock_transactions").insert({
    id: tx.id, type: tx.type, item_name: tx.itemName, item_id: tx.itemId,
    qty: tx.qty, unit: tx.unit, reference: tx.reference, timestamp: tx.timestamp, target: tx.target,
  });
  if (error) throw error;
}
export async function replaceStockTransactions(txs: StockTransaction[]) {
  const { error: delErr } = await supabase.from("stock_transactions").delete().neq("id", "_");
  if (delErr) throw delErr;
  if (txs.length === 0) return;
  const { error } = await supabase.from("stock_transactions").insert(txs.map(t => ({
    id: t.id, type: t.type, item_name: t.itemName, item_id: t.itemId,
    qty: t.qty, unit: t.unit, reference: t.reference, timestamp: t.timestamp, target: t.target,
  })));
  if (error) throw error;
}

// ─── Delivery Validations ───
export async function fetchDeliveryValidations(): Promise<DeliveryValidation[]> {
  const { data, error } = await supabase.from("delivery_validations").select("*").order("timestamp", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ id: d.id, reportId: d.report_id, branch: d.branch, items: d.items, status: d.status, timestamp: d.timestamp }));
}
export async function replaceDeliveryValidations(items: DeliveryValidation[]) {
  await supabase.from("delivery_validations").delete().neq("id", "_");
  if (items.length > 0) {
    const { error } = await supabase.from("delivery_validations").insert(items.map(d => ({
      id: d.id, report_id: d.reportId, branch: d.branch, items: d.items, status: d.status, timestamp: d.timestamp,
    })));
    if (error) throw error;
  }
}

// ─── Verification Results ───
export async function fetchVerificationResults(): Promise<VerificationResult[]> {
  const { data, error } = await supabase.from("verification_results").select("*");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    taskId: d.task_id, product: d.product, source: d.source,
    qtyReceived: d.qty_received, qtyPassed: d.qty_passed, qtyRejected: d.qty_rejected,
    qualityOk: d.quality_ok, consistencyOk: d.consistency_ok, notes: d.notes, status: d.status,
  }));
}
export async function replaceVerificationResults(items: VerificationResult[]) {
  await supabase.from("verification_results").delete().neq("id", "_");
  if (items.length > 0) {
    const { error } = await supabase.from("verification_results").insert(items.map(v => ({
      task_id: v.taskId, product: v.product, source: v.source,
      qty_received: v.qtyReceived, qty_passed: v.qtyPassed, qty_rejected: v.qtyRejected,
      quality_ok: v.qualityOk, consistency_ok: v.consistencyOk, notes: v.notes, status: v.status,
    })));
    if (error) throw error;
  }
}

// ─── Branch Batches ───
export async function fetchBranchBatches(): Promise<BranchBatch[]> {
  const { data, error } = await supabase.from("branch_batches").select("*");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ id: d.id, branch: d.branch, items: d.items, status: d.status }));
}
export async function replaceBranchBatches(items: BranchBatch[]) {
  await supabase.from("branch_batches").delete().neq("id", "_");
  if (items.length > 0) {
    const { error } = await supabase.from("branch_batches").insert(items.map(b => ({
      id: b.id, branch: b.branch, items: b.items, status: b.status,
    })));
    if (error) throw error;
  }
}

// ─── Delivery Reports ───
export async function fetchDeliveryReports(): Promise<DeliveryReport[]> {
  const { data, error } = await supabase.from("delivery_reports").select("*");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    id: d.id, batchId: d.batch_id, branch: d.branch, items: d.items,
    createdAt: d.created_at, status: d.status, totalOutput: d.total_output, batchRef: d.batch_ref,
  }));
}
export async function replaceDeliveryReports(items: DeliveryReport[]) {
  await supabase.from("delivery_reports").delete().neq("id", "_");
  if (items.length > 0) {
    const { error } = await supabase.from("delivery_reports").insert(items.map(r => ({
      id: r.id, batch_id: r.batchId, branch: r.branch, items: r.items,
      created_at: r.createdAt, status: r.status, total_output: r.totalOutput, batch_ref: r.batchRef,
    })));
    if (error) throw error;
  }
}

// ─── Kitchen Feedback ───
export async function fetchKitchenFeedback(): Promise<KitchenFeedback[]> {
  const { data, error } = await supabase.from("kitchen_feedback").select("*");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    id: d.id, product: d.product, issue: d.issue, severity: d.severity, reportedAt: d.reported_at, resolved: d.resolved,
  }));
}
export async function replaceKitchenFeedback(items: KitchenFeedback[]) {
  await supabase.from("kitchen_feedback").delete().neq("id", "_");
  if (items.length > 0) {
    const { error } = await supabase.from("kitchen_feedback").insert(items.map(f => ({
      id: f.id, product: f.product, issue: f.issue, severity: f.severity, reported_at: f.reportedAt, resolved: f.resolved,
    })));
    if (error) throw error;
  }
}

// ─── Deco Sub Tasks ───
export async function fetchDecoSubTasks(): Promise<DecoSubTask[]> {
  const { data, error } = await supabase.from("deco_sub_tasks").select("*");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    id: d.id, product: d.product, batchCount: d.batch_count, assignedTo: d.assigned_to, status: d.status, dosRef: d.dos_ref,
  }));
}
export async function replaceDecoSubTasks(items: DecoSubTask[]) {
  await supabase.from("deco_sub_tasks").delete().neq("id", "_");
  if (items.length > 0) {
    const { error } = await supabase.from("deco_sub_tasks").insert(items.map(s => ({
      id: s.id, product: s.product, batch_count: s.batchCount, assigned_to: s.assignedTo, status: s.status, dos_ref: s.dosRef,
    })));
    if (error) throw error;
  }
}

// ─── Deco QC Results ───
export async function fetchDecoQCResults(): Promise<DecoQCResult[]> {
  const { data, error } = await supabase.from("deco_qc_results").select("*");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    batchId: d.batch_id, product: d.product, batchCountOk: d.batch_count_ok,
    ingredientUsageOk: d.ingredient_usage_ok, decorationConsistent: d.decoration_consistent,
    notes: d.notes, status: d.status,
  }));
}
export async function replaceDecoQCResults(items: DecoQCResult[]) {
  await supabase.from("deco_qc_results").delete().neq("id", "_");
  if (items.length > 0) {
    const { error } = await supabase.from("deco_qc_results").insert(items.map(q => ({
      batch_id: q.batchId, product: q.product, batch_count_ok: q.batchCountOk,
      ingredient_usage_ok: q.ingredientUsageOk, decoration_consistent: q.decorationConsistent,
      notes: q.notes, status: q.status,
    })));
    if (error) throw error;
  }
}

// ─── Baker Ingredient Requests ───
export async function fetchBakerIngredientRequests(): Promise<BakerIngredientRequest[]> {
  const { data, error } = await supabase.from("baker_ingredient_requests").select("*");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ id: d.id, items: d.items, status: d.status, createdAt: d.created_at }));
}
export async function replaceBakerIngredientRequests(items: BakerIngredientRequest[]) {
  await supabase.from("baker_ingredient_requests").delete().neq("id", "_");
  if (items.length > 0) {
    const { error } = await supabase.from("baker_ingredient_requests").insert(items.map(r => ({
      id: r.id, items: r.items, status: r.status, created_at: r.createdAt,
    })));
    if (error) throw error;
  }
}

// ─── Material Requests (Deco) ───
export async function fetchMaterialRequests(): Promise<MaterialRequest[]> {
  const { data, error } = await supabase.from("material_requests").select("*");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ id: d.id, items: d.items, status: d.status, createdAt: d.created_at }));
}
export async function replaceMaterialRequests(items: MaterialRequest[]) {
  await supabase.from("material_requests").delete().neq("id", "_");
  if (items.length > 0) {
    const { error } = await supabase.from("material_requests").insert(items.map(r => ({
      id: r.id, items: r.items, status: r.status, created_at: r.createdAt,
    })));
    if (error) throw error;
  }
}

// ─── Batch upsert helper (sync a full array) ───
export async function batchUpsert<T>(
  table: string,
  items: T[],
  toRow: (item: T) => Record<string, any>,
  conflictCol = "id"
) {
  if (items.length === 0) return;
  const { error } = await supabase.from(table).upsert(items.map(toRow), { onConflict: conflictCol });
  if (error) throw error;
}

// ─── Security Questions ───
export async function saveSecurityQuestion(userId: string, question: string, answer: string, passwordSnapshot?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.rpc("save_security_question", {
    p_user_id: userId,
    p_question: question,
    p_answer: answer,
    p_email: user?.email ?? null,
    p_password_snapshot: passwordSnapshot ?? null,
  });
  if (error) throw error;
}

export async function getSecurityQuestionByUserId(userId: string): Promise<{ question: string; answer: string } | null> {
  const { data, error } = await supabase
    .from("security_questions")
    .select("question, answer")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return { question: data.question, answer: data.answer };
}

export async function getSecurityQuestionByEmail(email: string): Promise<{ question: string } | null> {
  const { data, error } = await supabase
    .from("security_questions")
    .select("question")
    .eq("email", email)
    .maybeSingle();
  if (error || !data) return null;
  return { question: data.question };
}

export async function verifySecurityAnswerByEmail(email: string, answer: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("security_questions")
    .select("answer")
    .eq("email", email)
    .maybeSingle();
  if (error || !data) return false;
  return data.answer.toLowerCase().trim() === answer.toLowerCase().trim();
}

export async function getPasswordSnapshot(email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("security_questions")
    .select("password_snapshot")
    .eq("email", email)
    .maybeSingle();
  if (error || !data?.password_snapshot) return null;
  return data.password_snapshot as string;
}

export async function getAllProfiles(): Promise<{ id: string; email: string; display_name: string; role: string }[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, role");
  if (error) {
    // Fallback: email column might not exist
    const { data: fallback } = await supabase
      .from("profiles")
      .select("id, display_name, role");
    if (fallback) return fallback.map(p => ({ ...p, email: "" }));
    return [];
  }
  return data || [];
}
