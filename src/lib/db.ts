import { supabase } from "./supabase";
import type {
  InventoryItem, DOSItem, ProductionTask, Delivery, AuditLog,
  ProductRecipe, BakerIngredientRequest, MaterialRequest,
  StockTransaction, DeliveryValidation, VerificationResult,
  BranchBatch, DeliveryReport, KitchenFeedback, DecoSubTask, DecoQCResult,
  ProductPricing, FreezerItem, FreezerHistory, Purchase, BillDue, Revenue, WasteLog,
  PromoPackage, ProductionPlan, Equipment, RepairRecord,
} from "../types";

function parseDOS(d: any): DOSItem {
  return { id: d.id, product: d.product, qty: d.qty, priority: d.priority, status: d.status, scheduledDate: d.scheduled_date || undefined, roles: d.roles || undefined, flavor: d.flavor || undefined, size: d.size || undefined, themeOccasion: d.theme_occasion || undefined, colorScheme: d.color_scheme || undefined, cakeDesignNotes: d.cake_design_notes || undefined, topper: d.topper || undefined, referenceImage: d.reference_image || undefined, messageCaption: d.message_caption || undefined, customerName: d.customer_name || undefined, pickupDeliveryTime: d.pickup_delivery_time || undefined, contactNumber: d.contact_number || undefined, dateOfEvent: d.date_of_event || undefined, layers: d.layers || undefined };
}
function toDOSRow(d: DOSItem) {
  return { id: d.id, product: d.product, qty: d.qty, priority: d.priority, status: d.status, scheduled_date: d.scheduledDate || null, roles: d.roles ?? [], flavor: d.flavor || null, size: d.size || null, theme_occasion: d.themeOccasion || null, color_scheme: d.colorScheme || null, cake_design_notes: d.cakeDesignNotes || null, topper: d.topper || null, reference_image: d.referenceImage || null, message_caption: d.messageCaption || null, customer_name: d.customerName || null, pickup_delivery_time: d.pickupDeliveryTime || null, contact_number: d.contactNumber || null, date_of_event: d.dateOfEvent || null, layers: d.layers || null };
}

function parseProduction(p: any): ProductionTask {
  return { id: p.id, product: p.product, target: p.target, completed: p.completed, assignedTo: p.assigned_to, status: p.status };
}
function toProductionRow(p: ProductionTask) {
  return { id: p.id, product: p.product, target: p.target, completed: p.completed, assigned_to: p.assignedTo, status: p.status };
}

function parseDelivery(d: any): Delivery {
  return { id: d.id, branch: d.branch, address: d.address ?? "", contactNumber: d.contact_number ?? "", assignedRider: d.assigned_rider ?? "", items: d.items ?? [], status: d.status, eta: d.eta, paymentStatus: d.payment_status ?? "unpaid", modeOfPayment: d.mode_of_payment ?? "cash", notes: d.notes ?? "", totalAmount: d.total_amount ?? undefined };
}
function toDeliveryRow(d: Delivery) {
  return { id: d.id, branch: d.branch, address: d.address ?? "", contact_number: d.contactNumber ?? "", assigned_rider: d.assignedRider ?? "", items: d.items, status: d.status, eta: d.eta, payment_status: d.paymentStatus ?? "unpaid", mode_of_payment: d.modeOfPayment ?? "cash", notes: d.notes ?? "", total_amount: d.totalAmount ?? null };
}

// ─── Inventory ───
// Table name mapping for separate inventory tables
const INVENTORY_TABLES: Record<string, string> = {
  "ingredients": "ingredients",
  "packaging-materials": "packaging_materials",
  "decoration-supplies": "decoration_supplies",
  "operational-supplies": "operational_supplies",
  "consumables": "consumables",
};

function parseInventoryItem(d: any, group: string): InventoryItem {
  const raw = d.access_roles;
  let accessRoles: string[] = [];
  if (Array.isArray(raw)) accessRoles = raw;
  else if (typeof raw === "string" && raw.startsWith("[")) { try { accessRoles = JSON.parse(raw); } catch { accessRoles = []; } }
  return { id: d.id, name: d.name, sku: d.sku, unit: d.unit, onHand: d.on_hand, threshold: d.threshold, cost: d.cost, supplier: d.supplier, lastIn: d.last_in, category: d.category, group: group as InventoryItem["group"], expiryDate: d.expiry_date || undefined, accessRoles, source: d.source || undefined, size: d.size || undefined };
}
function toInventoryRow(i: InventoryItem) {
  const row: Record<string, any> = { id: i.id, name: i.name, sku: i.sku, unit: i.unit, on_hand: Math.round(i.onHand), threshold: Math.round(i.threshold), cost: i.cost, supplier: i.supplier, last_in: i.lastIn, category: i.category, expiry_date: i.expiryDate || null, access_roles: i.accessRoles ?? [], source: i.source ?? null };
  if (i.size) row.size = i.size;
  return row;
}

export async function fetchInventoryByGroup(group: string): Promise<InventoryItem[]> {
  const table = INVENTORY_TABLES[group];
  if (!table) return [];
  const { data, error } = await supabase.from(table).select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(d => parseInventoryItem(d, group));
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
  // Tables that have 'size', 'source', 'access_roles' columns
  const TABLES_WITH_SIZE = new Set(["ingredients", "decoration_supplies", "packaging_materials", "operational_supplies", "consumables"]);
  const TABLES_WITH_SOURCE = new Set(["ingredients", "decoration_supplies", "packaging_materials", "operational_supplies", "consumables"]);
  const TABLES_WITH_ACCESS = new Set(["ingredients", "decoration_supplies", "packaging_materials", "operational_supplies", "consumables"]);
  // Group items by table, then batch-upsert each table with one call
  const grouped = new Map<string, InventoryItem[]>();
  for (const item of items) {
    const table = INVENTORY_TABLES[item.group];
    if (!table) continue;
    if (!grouped.has(table)) grouped.set(table, []);
    grouped.get(table)!.push(item);
  }
  await Promise.all([...grouped.entries()].map(([table, tableItems]) => {
    const rows = tableItems.map(i => {
      const row = toInventoryRow(i);
      if (!TABLES_WITH_SIZE.has(table)) delete row.size;
      if (!TABLES_WITH_SOURCE.has(table)) delete row.source;
      if (!TABLES_WITH_ACCESS.has(table)) delete row.access_roles;
      return row;
    });
    return supabase.from(table).upsert(rows, { onConflict: "id" }).then(r => { if (r.error) throw r.error; });
  }));
}

export async function updateInventoryItem(id: string, updates: Partial<InventoryItem>) {
  const group = updates.group;
  const table = group ? INVENTORY_TABLES[group] : null;
  if (!table) throw new Error(`Cannot update — group is required`);
  const row: any = {};
  if ("onHand" in updates) row.on_hand = Math.round(updates.onHand);
  if ("name" in updates) row.name = updates.name;
  if ("sku" in updates) row.sku = updates.sku;
  if ("unit" in updates) row.unit = updates.unit;
  if ("threshold" in updates) row.threshold = Math.round(updates.threshold);
  if ("cost" in updates) row.cost = updates.cost;
  if ("supplier" in updates) row.supplier = updates.supplier;
  if ("lastIn" in updates) row.last_in = updates.lastIn;
  if ("category" in updates) row.category = updates.category;
  if ("accessRoles" in updates) row.access_roles = updates.accessRoles ?? [];
  if ("source" in updates) row.source = updates.source ?? null;
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
  if ("roles" in updates) row.roles = updates.roles ?? [];
  if ("flavor" in updates) row.flavor = updates.flavor || null;
  if ("size" in updates) row.size = updates.size || null;
  if ("themeOccasion" in updates) row.theme_occasion = updates.themeOccasion || null;
  if ("colorScheme" in updates) row.color_scheme = updates.colorScheme || null;
  if ("cakeDesignNotes" in updates) row.cake_design_notes = updates.cakeDesignNotes || null;
  if ("topper" in updates) row.topper = updates.topper || null;
  if ("referenceImage" in updates) row.reference_image = updates.referenceImage || null;
  if ("messageCaption" in updates) row.message_caption = updates.messageCaption || null;
  if ("customerName" in updates) row.customer_name = updates.customerName || null;
  if ("pickupDeliveryTime" in updates) row.pickup_delivery_time = updates.pickupDeliveryTime || null;
  if ("contactNumber" in updates) row.contact_number = updates.contactNumber || null;
  if ("dateOfEvent" in updates) row.date_of_event = updates.dateOfEvent || null;
  if ("layers" in updates) row.layers = updates.layers || null;
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

export async function deleteProductionTask(id: string) {
  const { error } = await supabase.from("production_tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function clearProductionTasksByAssignee(assignedTo: string) {
  const { error } = await supabase.from("production_tasks").delete().eq("assigned_to", assignedTo);
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
export async function migrateBranchNames() {
  await supabase.from("deliveries").update({ branch: "Cakes N Styles Gensan" }).eq("branch", "Makati");
  await supabase.from("deliveries").update({ branch: "Cakes N Styles Gensan" }).eq("branch", "Branch 1 - Makati");
  await supabase.from("deliveries").update({ branch: "Shadrach's Bake & Brew" }).eq("branch", "BGC");
  await supabase.from("deliveries").update({ branch: "Shadrach's Bake & Brew" }).eq("branch", "Branch 2 - BGC");
}
export function subscribeDeliveries(onChange: () => void) {
  const channel = supabase.channel("deliveries-realtime").on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => { onChange(); }).subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function subscribeFreezer(onChange: () => void) {
  const channel = supabase.channel("freezer-realtime").on("postgres_changes", { event: "*", schema: "public", table: "freezer_items" }, () => { onChange(); }).subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function subscribeDOS(onChange: () => void) {
  const channel = supabase.channel("dos-realtime").on("postgres_changes", { event: "*", schema: "public", table: "dos_items" }, () => { onChange(); }).subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function subscribeProduction(onChange: () => void) {
  const channel = supabase.channel("production-realtime").on("postgres_changes", { event: "*", schema: "public", table: "production_tasks" }, () => { onChange(); }).subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function subscribeInventory(onChange: () => void) {
  const channels = Object.values(INVENTORY_TABLES).map(table =>
    supabase.channel(`${table}-realtime`).on("postgres_changes", { event: "*", schema: "public", table }, () => { onChange(); }).subscribe()
  );
  return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
}

export function subscribeRecipes(onChange: () => void) {
  const channel = supabase.channel("recipes-realtime").on("postgres_changes", { event: "*", schema: "public", table: "recipes" }, () => { onChange(); }).subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function subscribeProductRecipeLinks(onChange: () => void) {
  const channel = supabase.channel("links-realtime").on("postgres_changes", { event: "*", schema: "public", table: "product_recipe_links" }, () => { onChange(); }).subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function subscribeProductCatalog(onChange: () => void) {
  const channel = supabase.channel("catalog-realtime").on("postgres_changes", { event: "*", schema: "public", table: "product_catalog" }, () => { onChange(); }).subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── Deco Production Prep ───
export type AdditionalIngredient = { name: string; qty: number; unit: string; reason: string; source: string; timestamp?: string };

export async function fetchDecoProductionPrep(): Promise<{ dosId: string; productName: string; productQty: number; prepared: boolean; done: boolean; additionalIngredients: AdditionalIngredient[] }[]> {
  const { data, error } = await supabase.from("deco_production_prep").select("*");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    dosId: d.dos_id,
    productName: d.product_name,
    productQty: d.product_qty,
    prepared: d.prepared,
    done: d.done,
    additionalIngredients: d.additional_ingredients ?? [],
  }));
}

export async function saveDecoProductionPrep(items: { dosId: string; productName: string; productQty: number; prepared: boolean; done: boolean; additionalIngredients: AdditionalIngredient[] }[]) {
  if (items.length === 0) return;
  const { error } = await supabase.from("deco_production_prep").upsert(
    items.map(i => ({
      dos_id: i.dosId,
      product_name: i.productName,
      product_qty: i.productQty,
      prepared: i.prepared,
      done: i.done,
      additional_ingredients: i.additionalIngredients,
    })),
    { onConflict: "dos_id,product_name" }
  );
  if (error) throw error;
}

// ─── Cake Productions (Deco Queue) ───
export type DecoQueueRow = {
  id: string;
  product: string;
  orderRef: string;
  theme: string;
  status: "pending" | "in-progress" | "completed";
  notes: string;
  customerName?: string;
  sourceInventoryId?: string;
  sourceQty?: number;
  sourceBatchRef?: string;
  sourceProducedBy?: string;
  sourceSnapshot?: InventoryItem;
  createdAt?: string;
};

export async function fetchDecorationQueue(): Promise<DecoQueueRow[]> {
  const { data, error } = await supabase.from("decoration_queue").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    id: d.id,
    product: d.product,
    orderRef: d.order_ref ?? "",
    theme: d.theme ?? "Standard",
    status: d.status ?? "pending",
    notes: d.notes ?? "",
    customerName: d.customer_name || undefined,
    sourceInventoryId: d.freezer_item_id || undefined,
    sourceQty: d.source_qty ?? undefined,
    sourceBatchRef: d.source_batch_ref || undefined,
    sourceProducedBy: d.source_produced_by || undefined,
    sourceSnapshot: d.source_snapshot || undefined,
    createdAt: d.created_at || undefined,
  }));
}

export async function upsertDecorationQueueTask(task: DecoQueueRow) {
  const row: any = {
    id: task.id,
    product: task.product,
    order_ref: task.orderRef,
    theme: task.theme,
    status: task.status,
    notes: task.notes,
    customer_name: task.customerName ?? null,
    freezer_item_id: task.sourceInventoryId ?? null,
    source_qty: task.sourceQty ?? null,
    source_batch_ref: task.sourceBatchRef ?? null,
    source_produced_by: task.sourceProducedBy ?? null,
    source_snapshot: task.sourceSnapshot ?? null,
    created_at: task.createdAt ?? null,
  };
  const { error } = await supabase.from("decoration_queue").upsert(row, { onConflict: "id" });
  if (error) throw error;
}

export async function deleteDecorationQueueTask(id: string) {
  const { error } = await supabase.from("decoration_queue").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeDecorationQueue(onChange: () => void) {
  const channel = supabase.channel("decoration-queue-realtime").on("postgres_changes", { event: "*", schema: "public", table: "decoration_queue" }, () => { onChange(); }).subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── Audit Logs ───
export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase.from("audit_logs").select("*").order("id", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ id: d.id, timestamp: d.timestamp, userName: d.user_name, role: d.role, action: d.action, details: d.details }));
}

export async function clearAuditLogs(): Promise<void> {
  await supabase.from("audit_logs").delete().neq("id", "");
}

function generateId(): string {
  // Works across all modern browsers, with fallback for older environments
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // crypto.getRandomValues is supported in all modern browsers
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
    buf[8] = (buf[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last-resort fallback for very old environments
  return `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function addAuditLog(log: Omit<AuditLog, "id">): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    id: generateId(),
    timestamp: log.timestamp,
    user_name: log.userName,
    role: log.role,
    action: log.action,
    details: log.details,
  });
  if (error) console.error("audit log error:", error);
}

// ─── Product Categories ───
export async function fetchCategories(): Promise<string[]> {
  const { data, error } = await supabase.from("product_categories").select("name").order("name");
  if (error) throw error;
  return (data ?? []).map((r: any) => r.name);
}

export async function addCategory(name: string) {
  const { error } = await supabase.from("product_categories").upsert({ name }, { onConflict: "name" });
  if (error && (error as any)?.code !== "23505") throw error;
}

export async function removeCategory(name: string) {
  // Unassign from products first, then delete
  await supabase.from("product_catalog").update({ category: null }).eq("category", name);
  const { error } = await supabase.from("product_categories").delete().eq("name", name);
  if (error) throw error;
}

export async function renameCategory(oldName: string, newName: string) {
  // Update the category name in product_categories
  const { error: catErr } = await supabase.from("product_categories").update({ name: newName }).eq("name", oldName);
  if (catErr) throw catErr;
  // Update all products assigned to this category
  const { error: prodErr } = await supabase.from("product_catalog").update({ category: newName }).eq("category", oldName);
  if (prodErr) throw prodErr;
}

export async function fetchProductCategories(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("product_catalog").select("name, category");
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const r of (data ?? [])) {
    if (r.category) map[r.name] = r.category;
  }
  return map;
}

export async function saveProductCategory(productName: string, category: string | null) {
  // 1. If a category is provided, ensure it exists in product_categories first
  if (category) {
    const { error: catErr } = await supabase.from("product_categories").upsert({ name: category }, { onConflict: "name" });
    if (catErr && (catErr as any).code !== '23505') { // 23505 = unique_violation (duplicate)
      console.error("Failed to ensure category exists:", catErr);
      throw catErr;
    }
  }

  // 2. Perform the upsert on product_catalog
  const { error } = await supabase.from("product_catalog").upsert({ name: productName, category }, { onConflict: "name" });
  if (error) {
    console.error("Supabase upsert error details:", JSON.stringify(error, null, 2));
    throw error;
  }
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
export async function removeFromCatalog(name: string) {
  const { error } = await supabase.from("product_catalog").delete().eq("name", name);
  if (error) throw error;
}

// ─── Product Routes (default team assignment) ───
export type ProductRoute = "baker" | "deco" | "pastry";
export async function fetchProductRoutes(): Promise<Record<string, ProductRoute>> {
  const { data, error } = await supabase.from("product_catalog").select("name, default_role");
  if (error) throw error;
  const map: Record<string, ProductRoute> = {};
  for (const r of (data ?? []) as any[]) {
    if (r.default_role) map[r.name] = r.default_role;
  }
  return map;
}
export async function saveProductRoute(productName: string, role: ProductRoute | null) {
  const { error } = await supabase.from("product_catalog").upsert({ name: productName, default_role: role }, { onConflict: "name" });
  if (error) throw error;
}
export async function deleteRecipe(productName: string) {
  // Delete links first, then the recipe
  const { data: found } = await supabase.from("recipes").select("id").eq("name", productName).maybeSingle();
  if (found) {
    await supabase.from("product_recipe_links").delete().eq("recipe_id", found.id);
  }
  const { error } = await supabase.from("recipes").delete().eq("name", productName);
  if (error) throw error;
}

// ─── Recipes ───
export async function fetchRecipes(): Promise<ProductRecipe[]> {
  // Fetch from new recipes table with linked products
  const { data, error } = await supabase.from("recipes").select("*");
  if (error) throw error;
  const { data: links } = await supabase.from("product_recipe_links").select("*");
  return (data ?? []).map((r: any) => ({
    id: r.id,
    productId: r.id,
    productName: r.name,
    ingredients: r.ingredients ?? [],
    packagingMaterials: r.packaging_materials ?? [],
    decorationSupplies: r.decoration_supplies ?? [],
    notes: r.notes ?? "",
    group: r.recipe_group || "",
    yield: r.yield ?? undefined,
    linkedIngredients: (links ?? []).filter((l: any) => l.recipe_id === r.id).map((l: any) => l.product_name),
  }));
}
export async function upsertRecipe(recipe: ProductRecipe) {
  const recipeId = recipe.id || `RCP-${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const { error } = await supabase.from("recipes").upsert({
    id: recipeId,
    name: recipe.productName,
    ingredients: recipe.ingredients,
    packaging_materials: recipe.packagingMaterials ?? [],
    decoration_supplies: recipe.decorationSupplies ?? [],
    notes: recipe.notes ?? "",
    recipe_group: recipe.group || "",
    yield: recipe.yield ?? null,
  }, { onConflict: "name" });
  if (error) {
    console.error("recipe upsert failed:", error);
    return;
  }
  // Update product_recipe_links — save each linked ingredient name
  if (recipe.productName) {
    const { data: inserted } = await supabase.from("recipes").select("id").eq("name", recipe.productName).maybeSingle();
    if (inserted) {
      // Delete existing links for this recipe, then insert new ones
      await supabase.from("product_recipe_links").delete().eq("recipe_id", inserted.id);
      const linked = recipe.linkedIngredients ?? [];
      if (linked.length > 0) {
        const { error: linkErr } = await supabase.from("product_recipe_links").insert(
          linked.map(product_name => ({ product_name, recipe_id: inserted.id }))
        );
        if (linkErr) console.error("product_recipe_links insert failed:", linkErr);
      }
    }
  }
}

// ─── Stock Transactions ───
export async function fetchStockTransactions(): Promise<StockTransaction[]> {
  const { data, error } = await supabase.from("stock_transactions").select("*").order("timestamp", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    id: d.id, type: d.type, itemName: d.item_name, itemId: d.item_id,
    qty: d.qty, unit: d.unit, reference: d.reference, timestamp: d.timestamp, target: d.target, group: d.group_name || "", role: d.role || "",
  }));
}
export async function insertStockTransaction(tx: StockTransaction) {
  const { error } = await supabase.from("stock_transactions").insert({
    id: tx.id, type: tx.type, item_name: tx.itemName, item_id: tx.itemId,
    qty: tx.qty, unit: tx.unit, reference: tx.reference, timestamp: tx.timestamp, target: tx.target, group_name: tx.group || "", role: tx.role || "",
  });
  if (error) throw error;
}
export async function replaceStockTransactions(txs: StockTransaction[]) {
  const { error: delErr } = await supabase.from("stock_transactions").delete().neq("id", "_");
  if (delErr) throw delErr;
  if (txs.length === 0) return;
  const { error } = await supabase.from("stock_transactions").insert(txs.map(t => ({
    id: t.id, type: t.type, item_name: t.itemName, item_id: t.itemId,
    qty: t.qty, unit: t.unit, reference: t.reference, timestamp: t.timestamp, target: t.target, group_name: t.group || "", role: t.role || "",
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

// ─── Product Pricing ───
function parsePricing(d: any): ProductPricing {
  return {
    id: d.id,
    productName: d.product_name,
    category: d.category ?? "",
    estimatedCost: d.estimated_cost ?? 0,
    sellingPrice: d.selling_price ?? 0,
    wholesalePrice: d.wholesale_price ?? 0,
    profitMargin: d.profit_margin ?? 0,
    status: d.status ?? "draft",
    variants: d.variants ?? [],
  };
}
function toPricingRow(p: ProductPricing) {
  return {
    id: p.id,
    product_name: p.productName,
    category: p.category,
    estimated_cost: p.estimatedCost,
    selling_price: p.sellingPrice,
    wholesale_price: p.wholesalePrice,
    profit_margin: p.profitMargin,
    status: p.status,
    variants: p.variants,
  };
}
export async function fetchProductPricing(): Promise<ProductPricing[]> {
  try {
    const { data, error } = await supabase.from("product_pricing").select("*").order("product_name");
    if (error) throw error;
    return (data ?? []).map(parsePricing);
  } catch {
    return [];
  }
}
export async function upsertProductPricing(items: ProductPricing[]) {
  try {
    const { error } = await supabase.from("product_pricing").upsert(items.map(toPricingRow), { onConflict: "id" });
    if (error) throw error;
  } catch (e) {
    console.error("product_pricing upsert failed (table may not exist):", e);
  }
}
export async function upsertSingleProductPricing(item: ProductPricing) {
  try {
    const { error } = await supabase.from("product_pricing").upsert(toPricingRow(item), { onConflict: "id" });
    if (error) throw error;
  } catch (e) {
    console.error("product_pricing upsert failed:", e);
  }
}
export async function deleteProductPricing(id: string) {
  try {
    const { error } = await supabase.from("product_pricing").delete().eq("id", id);
    if (error) throw error;
  } catch (e) {
    console.error("product_pricing delete failed:", e);
  }
}

// ─── Freezer / Finished Products ───
function parseFreezerItem(d: any): FreezerItem {
  const notes = d.notes ?? "";
  const sizeMatch = notes.match(/ \| Size: (.+)$/);
  return {
    id: d.id,
    productName: d.product_name,
    qty: d.qty ?? 0,
    unit: d.unit ?? "pcs",
    batchRef: d.batch_ref ?? "",
    producedBy: d.produced_by ?? "",
    dateProduced: d.date_produced ?? "",
    status: d.status ?? "stored",
    notes: sizeMatch ? notes.slice(0, -(sizeMatch[0].length)) : notes,
    size: d.size || (sizeMatch ? sizeMatch[1] : undefined),
  };
}
function toFreezerRow(i: FreezerItem) {
  return {
    id: i.id,
    product_name: i.productName,
    qty: i.qty,
    unit: i.unit,
    batch_ref: i.batchRef,
    produced_by: i.producedBy,
    date_produced: i.dateProduced,
    status: i.status,
    notes: i.notes ?? "",
    size: i.size ?? "",
  };
}
export async function fetchFreezerItems(): Promise<FreezerItem[]> {
  try {
    const { data, error } = await supabase.from("freezer_items").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(parseFreezerItem);
  } catch {
    return [];
  }
}
export async function upsertFreezerItems(items: FreezerItem[]): Promise<boolean> {
  try {
    const { error } = await supabase.from("freezer_items").upsert(items.map(toFreezerRow), { onConflict: "id" });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("freezer_items upsert failed:", e);
    return false;
  }
}
export async function deleteFreezerItem(id: string) {
  try {
    // Delete related assembly tasks first to avoid foreign key conflict
    await supabase.from("baker_assembly_tasks").delete().eq("premix_item_id", id);
    const { error } = await supabase.from("freezer_items").delete().eq("id", id);
    if (error) throw error;
  } catch (e) {
    console.error("freezer_items delete failed:", e);
  }
}

// ─── Freezer History ───
function parseFreezerHistory(d: any): FreezerHistory {
  return {
    id: d.id,
    productName: d.product_name,
    producedBy: d.produced_by ?? "",
    qtyChanged: d.qty_changed ?? 0,
    action: d.action ?? "",
    reference: d.reference ?? "",
    timestamp: d.timestamp ?? "",
  };
}
export async function fetchFreezerHistory(): Promise<FreezerHistory[]> {
  try {
    const { data, error } = await supabase.from("freezer_history").select("*").order("timestamp", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(parseFreezerHistory);
  } catch {
    return [];
  }
}
export async function insertFreezerHistory(entry: FreezerHistory) {
  try {
    const { error } = await supabase.from("freezer_history").insert({
      id: entry.id,
      product_name: entry.productName,
      produced_by: entry.producedBy,
      qty_changed: entry.qtyChanged,
      action: entry.action,
      reference: entry.reference,
      timestamp: entry.timestamp,
    });
    if (error) throw error;
  } catch (e) {
    console.error("freezer_history insert failed:", e);
  }
}

// ─── Purchases ───
export async function fetchPurchases(): Promise<Purchase[]> {
  const { data, error } = await supabase.from("purchases").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    id: d.id, supplierName: d.supplier_name, modeOfPayment: d.mode_of_payment,
    dateDelivered: d.date_delivered, particular: d.particular, amount: d.amount,
    dueDate: d.due_date, releasedDate: d.released_date, paymentStatus: d.payment_status,
    remarks: d.remarks, createdAt: d.created_at,
  }));
}
export async function upsertPurchases(items: Purchase[]) {
  const { error } = await supabase.from("purchases").upsert(items.map(p => ({
    id: p.id, supplier_name: p.supplierName, mode_of_payment: p.modeOfPayment,
    date_delivered: p.dateDelivered, particular: p.particular, amount: p.amount,
    due_date: p.dueDate, released_date: p.releasedDate, payment_status: p.paymentStatus,
    remarks: p.remarks,
  })), { onConflict: "id" });
  if (error) throw error;
}
export async function deletePurchase(id: string) {
  const { error } = await supabase.from("purchases").delete().eq("id", id);
  if (error) throw error;
}

// ─── Bills & Dues ───
export async function fetchBillsAndDues(): Promise<BillDue[]> {
  const { data, error } = await supabase.from("bills_and_dues").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    id: d.id, dueDate: d.due_date, particular: d.particular, amount: d.amount,
    modeOfPayment: d.mode_of_payment, remarks: d.remarks, status: d.status,
    category: d.category, branch: d.branch, createdAt: d.created_at,
  }));
}
export async function upsertBillsAndDues(items: BillDue[]) {
  const { error } = await supabase.from("bills_and_dues").upsert(items.map(b => ({
    id: b.id, due_date: b.dueDate, particular: b.particular, amount: b.amount,
    mode_of_payment: b.modeOfPayment, remarks: b.remarks, status: b.status,
    category: b.category, branch: b.branch,
  })), { onConflict: "id" });
  if (error) throw error;
}
export async function deleteBillDue(id: string) {
  const { error } = await supabase.from("bills_and_dues").delete().eq("id", id);
  if (error) throw error;
}

// ─── Revenue ───
export async function fetchRevenue(): Promise<Revenue[]> {
  const { data, error } = await supabase.from("revenue").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    id: d.id, source: d.source, particular: d.particular, branch: d.branch,
    amount: d.amount, date: d.date, modeOfPayment: d.mode_of_payment,
    referenceId: d.reference_id, remarks: d.remarks, createdAt: d.created_at,
  }));
}
export async function deleteRevenue(id: string) {
  const { error } = await supabase.from("revenue").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertRevenue(items: Revenue[]) {
  const { error } = await supabase.from("revenue").upsert(items.map(r => ({
    id: r.id, source: r.source, particular: r.particular, branch: r.branch,
    amount: r.amount, date: r.date, mode_of_payment: r.modeOfPayment,
    reference_id: r.referenceId, remarks: r.remarks,
  })), { onConflict: "id" });
  if (error) throw error;
}

// ─── Waste Log ───
export async function fetchWasteLog(): Promise<WasteLog[]> {
  const { data, error } = await supabase.from("waste_log").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    id: d.id, product: d.product, qtyRejected: d.qty_rejected, unitCost: d.unit_cost,
    totalCost: d.total_cost, reason: d.reason, source: d.source,
    referenceId: d.reference_id, date: d.date, createdAt: d.created_at,
  }));
}
// ─── Baker Assembly Tasks ───
export interface BakerAssemblyTask {
  id: string;
  productName: string;
  dosId?: string;
  dosQty?: number;
  premixItemId: string;
  premixQtyUsed: number;
  qtyAssembled: number;
  status: "pending" | "in_progress" | "completed";
  assembledBy: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchBakerAssemblyTasks(): Promise<BakerAssemblyTask[]> {
  const { data, error } = await supabase.from("baker_assembly_tasks").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    id: d.id,
    productName: d.product_name,
    dosId: d.dos_id,
    dosQty: d.dos_qty,
    premixItemId: d.premix_item_id,
    premixQtyUsed: d.premix_qty_used,
    qtyAssembled: d.qty_assembled,
    status: d.status,
    assembledBy: d.assembled_by,
    notes: d.notes,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
}

export async function saveBakerAssemblyTask(task: BakerAssemblyTask) {
  const { error } = await supabase.from("baker_assembly_tasks").upsert({
    id: task.id,
    product_name: task.productName,
    dos_id: task.dosId || null,
    dos_qty: task.dosQty ?? 0,
    premix_item_id: task.premixItemId,
    premix_qty_used: task.premixQtyUsed,
    qty_assembled: task.qtyAssembled,
    status: task.status,
    assembled_by: task.assembledBy,
    notes: task.notes ?? "",
  }, { onConflict: "id" });
  if (error) throw error;
}

export async function deleteBakerAssemblyTask(id: string) {
  const { error } = await supabase.from("baker_assembly_tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteBakerAssemblyTasksByDOSId(dosId: string) {
  const { error } = await supabase.from("baker_assembly_tasks").delete().eq("dos_id", dosId);
  if (error) throw error;
}

export async function deleteBakerAssemblyTasksByPremixItemId(premixItemId: string) {
  const { error } = await supabase.from("baker_assembly_tasks").delete().eq("premix_item_id", premixItemId);
  if (error) throw error;
}

// ─── Pastry Assembly Tasks ───
export async function fetchPastryAssemblyTasks(): Promise<import("../types").PastryAssemblyTask[]> {
  const { data, error } = await supabase.from("pastry_assembly_tasks").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    id: d.id,
    dosId: d.dos_id || undefined,
    promoId: d.promo_id || undefined,
    productName: d.product_name,
    promoType: d.promo_type ?? "package",
    components: d.components ?? [],
    targetQty: d.target_qty ?? 0,
    assembledQty: d.assembled_qty ?? 0,
    status: d.status ?? "pending",
    assembledBy: d.assembled_by ?? "",
    qcChecklist: d.qc_checklist ?? {},
    notes: d.notes ?? "",
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
}

export async function savePastryAssemblyTask(task: import("../types").PastryAssemblyTask) {
  const { error } = await supabase.from("pastry_assembly_tasks").upsert({
    id: task.id,
    dos_id: task.dosId || null,
    promo_id: task.promoId || null,
    product_name: task.productName,
    promo_type: task.promoType,
    components: task.components,
    target_qty: task.targetQty,
    assembled_qty: task.assembledQty,
    status: task.status,
    assembled_by: task.assembledBy,
    qc_checklist: task.qcChecklist ?? {},
    notes: task.notes ?? "",
  }, { onConflict: "id" });
  if (error) throw error;
}

export async function deletePastryAssemblyTask(id: string) {
  const { error } = await supabase.from("pastry_assembly_tasks").delete().eq("id", id);
  if (error) throw error;
}

export function subscribePastryAssemblyTasks(onChange: () => void) {
  const channel = supabase.channel("pastry-assembly-realtime").on("postgres_changes", { event: "*", schema: "public", table: "pastry_assembly_tasks" }, () => { onChange(); }).subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function upsertWasteLog(items: WasteLog[]) {
  const { error } = await supabase.from("waste_log").upsert(items.map(w => ({
    id: w.id, product: w.product, qty_rejected: w.qtyRejected, unit_cost: w.unitCost,
    total_cost: w.totalCost, reason: w.reason, source: w.source,
    reference_id: w.referenceId, date: w.date,
  })), { onConflict: "id" });
  if (error) throw error;
}

// ─── Promos & Packages ───
function parsePromoPackage(d: any): PromoPackage {
  return {
    id: d.id, name: d.name, description: d.description || "",
    type: d.type, items: d.items || [],
    originalPrice: d.original_price || 0, promoPrice: d.promo_price || 0,
    status: d.status, startDate: d.start_date || undefined,
    endDate: d.end_date || undefined, createdAt: d.created_at || undefined,
  };
}

function toPromoPackageRow(p: PromoPackage) {
  return {
    id: p.id, name: p.name, description: p.description,
    type: p.type, items: p.items, original_price: p.originalPrice,
    promo_price: p.promoPrice, status: p.status,
    start_date: p.startDate || null, end_date: p.endDate || null,
  };
}

export async function fetchPromosPackages(): Promise<PromoPackage[]> {
  const { data, error } = await supabase.from("promos_packages").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(parsePromoPackage);
}

export async function upsertPromoPackage(item: PromoPackage) {
  const { error } = await supabase.from("promos_packages").upsert(toPromoPackageRow(item), { onConflict: "id" });
  if (error) throw error;
}

export async function deletePromoPackage(id: string) {
  const { error } = await supabase.from("promos_packages").delete().eq("id", id);
  if (error) throw error;
}

export function subscribePromosPackages(onChange: () => void) {
  const channel = supabase.channel("promos-realtime").on("postgres_changes", { event: "*", schema: "public", table: "promos_packages" }, () => { onChange(); }).subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── Production Plans ───
function parseProductionPlan(d: any): ProductionPlan {
  return {
    id: d.id,
    date: d.date,
    dosItems: d.dos_items ?? [],
    recipeDemands: d.recipe_demands ?? [],
    batchCalculations: d.batch_calculations ?? [],
    outputAllocations: d.output_allocations ?? [],
    status: d.status,
    createdBy: d.created_by ?? "",
    createdAt: d.created_at ?? "",
    confirmedAt: d.confirmed_at || undefined,
  };
}

function toProductionPlanRow(p: ProductionPlan) {
  return {
    id: p.id,
    date: p.date,
    dos_items: p.dosItems,
    recipe_demands: p.recipeDemands,
    batch_calculations: p.batchCalculations,
    output_allocations: p.outputAllocations,
    status: p.status,
    created_by: p.createdBy,
    confirmed_at: p.confirmedAt || null,
  };
}

export async function fetchProductionPlans(): Promise<ProductionPlan[]> {
  const { data, error } = await supabase.from("production_plans").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(parseProductionPlan);
}

export async function fetchProductionPlanById(id: string): Promise<ProductionPlan | null> {
  const { data, error } = await supabase.from("production_plans").select("*").eq("id", id).single();
  if (error) return null;
  return parseProductionPlan(data);
}

export async function upsertProductionPlan(plan: ProductionPlan) {
  const { error } = await supabase.from("production_plans").upsert(toProductionPlanRow(plan), { onConflict: "id" });
  if (error) throw error;
}

export async function deleteProductionPlan(id: string) {
  const { error } = await supabase.from("production_plans").delete().eq("id", id);
  if (error) throw error;
}


// ─── Equipment ───
function parseEquipment(d: any): Equipment {
  return {
    id: d.id,
    name: d.name,
    datePurchased: d.date_purchased ?? "",
    dateRepaired: d.date_repaired ?? "",
    costPrice: d.cost_price ?? 0,
    supplier: d.supplier ?? "",
    status: d.status ?? "active",
    notes: d.notes ?? "",
  };
}

function toEquipmentRow(e: Equipment) {
  return {
    id: e.id,
    name: e.name,
    date_purchased: e.datePurchased,
    date_repaired: e.dateRepaired,
    cost_price: e.costPrice,
    supplier: e.supplier,
    status: e.status,
    notes: e.notes,
  };
}

export async function fetchEquipment(): Promise<Equipment[]> {
  const { data, error } = await supabase.from("equipment").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(parseEquipment);
}

export async function upsertEquipment(item: Equipment) {
  const { error } = await supabase.from("equipment").upsert(toEquipmentRow(item), { onConflict: "id" });
  if (error) throw error;
}

export async function deleteEquipment(id: string) {
  const { error } = await supabase.from("equipment").delete().eq("id", id);
  if (error) throw error;
}

// ─── Repair History ───
function parseRepairRecord(d: any): RepairRecord {
  return {
    id: d.id,
    equipmentId: d.equipment_id,
    repairDate: d.repair_date ?? "",
    repairCost: d.repair_cost ?? 0,
    remarks: d.remarks ?? "",
  };
}

function toRepairRow(r: RepairRecord) {
  return {
    id: r.id,
    equipment_id: r.equipmentId,
    repair_date: r.repairDate,
    repair_cost: r.repairCost,
    remarks: r.remarks,
  };
}

export async function fetchRepairRecords(equipmentId: string): Promise<RepairRecord[]> {
  const { data, error } = await supabase
    .from("repair_history")
    .select("*")
    .eq("equipment_id", equipmentId)
    .order("repair_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(parseRepairRecord);
}

export async function fetchAllRepairRecords(): Promise<RepairRecord[]> {
  const { data, error } = await supabase
    .from("repair_history")
    .select("*")
    .order("repair_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(parseRepairRecord);
}

export async function addRepairRecord(equipmentId: string, repairDate: string, repairCost: number = 0, remarks: string = ""): Promise<RepairRecord> {
  const id = `RPR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const record: RepairRecord = { id, equipmentId, repairDate, repairCost, remarks };
  const { error } = await supabase.from("repair_history").insert(toRepairRow(record));
  if (error) throw error;
  return record;
}

export async function deleteRepairRecord(id: string) {
  const { error } = await supabase.from("repair_history").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadReferenceImage(file: File, dosItemId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${dosItemId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("reference-images").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("reference-images").getPublicUrl(path);
  return data.publicUrl;
}
