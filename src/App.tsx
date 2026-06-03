import { useEffect, useMemo, useRef, useState } from "react";
import type { Role, InventoryItem, DOSItem, ProductionTask, Delivery, AuditLog, ProductRecipe, ProductPricing, FreezerItem, FreezerHistory, Purchase, BillDue, Revenue, WasteLog } from "./types";
import AdminDashboard from "./components/AdminDashboard";
import BakerDashboard from "./components/BakerDashboard";
import DecoDashboard from "./components/DecoDashboard";
import KitchenDashboard from "./components/KitchenDashboard";
import BranchDashboard from "./components/BranchDashboard";
import PastryDashboard from "./components/PastryDashboard";
import DOSBuilderModal from "./components/DOSBuilderModal";
import LoginPage from "./components/LoginPage";
import { getCurrentUser, getProfile, signOut as authSignOut, updateProfile, updatePassword } from "./lib/auth";

// Philippines timezone helper (UTC+8)
function getPHToday(): string {
  return new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0];
}
function getPHTimestamp(): string {
  return new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
import { supabase } from "./lib/supabase";
import * as db from "./lib/db";

const roleConfig: Record<Role, { name: string; title: string; color: string }> = {
  admin: { name: "Admin", title: "Operations Director", color: "from-amber-600 to-orange-600" },
  baker: { name: "Baker", title: "Head Baker", color: "from-stone-600 to-neutral-700" },
  deco: { name: "Deco", title: "Deco Lead", color: "from-rose-600 to-pink-600" },
  kitchen: { name: "Kitchen", title: "Kitchen Supervisor", color: "from-emerald-600 to-teal-600" },
  branch: { name: "Branch", title: "Branch Manager", color: "from-blue-600 to-indigo-600" },
  pastry: { name: "Pastry", title: "Pastry Chef", color: "from-amber-600 to-yellow-600" },
};

const sidebarItems: Record<Role, { id: string; label: string; icon: string }[]> = {
  admin: [
    { id: "dashboard", label: "Admin Dashboard", icon: "◼" },
    { id: "dos", label: "DOS Builder", icon: "◈" },
    { id: "products", label: "Products", icon: "⬢" },
    { id: "pricing", label: "Pricing", icon: "◇" },
    { id: "warehouse", label: "Warehouse", icon: "⬡" },
    { id: "production", label: "Production", icon: "⬣" },
    { id: "deliveries", label: "Deliveries", icon: "⬙" },
    { id: "finance", label: "Finance", icon: "◆" },
    { id: "audit", label: "Audit Logs", icon: "⬖" },
  ],
  baker: [
    { id: "dashboard", label: "My Tasks", icon: "◼" },
    { id: "freezer", label: "Freezer", icon: "◇" },
  ],
  deco: [
    { id: "dashboard", label: "Dashboard", icon: "" },
    { id: "free-mix", label: "Production Prep", icon: "" },
    { id: "advanced-premix", label: "Advanced Premix", icon: "" },
    { id: "deco-queue", label: "Decoration Queue", icon: "" },
    { id: "custom-orders", label: "Custom Orders", icon: "" },
    { id: "freezer", label: "Freezer", icon: "" },
  ],
  kitchen: [
    { id: "dashboard", label: "Dispatch", icon: "◼" },
    { id: "queue", label: "Queue", icon: "◈" },
    { id: "qc", label: "Quality Check", icon: "⬢" },
  ],
  branch: [
    { id: "dashboard", label: "Sales", icon: "◼" },
    { id: "deliveries", label: "Deliveries", icon: "◈" },
    { id: "inventory", label: "Stock", icon: "⬢" },
  ],
  pastry: [
    { id: "dashboard", label: "My Tasks", icon: "◼" },
    { id: "recipes", label: "Recipes", icon: "◈" },
    { id: "queue", label: "Production Queue", icon: "⬢" },
    { id: "freezer", label: "Freezer", icon: "◇" },
  ],
};

// Seed demo data if the database is empty
async function seedIfEmpty() {
  // Seed recipes independently (even if inventory already exists)
  const existingRecipes = await db.fetchRecipes();
  if (existingRecipes.length === 0) {
    const demoRecipes: ProductRecipe[] = [
      {
        productId: "Pandesal",
        productName: "Pandesal",
        ingredients: [
          { inventoryId: "dummy-bf-1", name: "Bread Flour", qtyPerBatch: 10, unit: "kg" },
          { inventoryId: "dummy-gs-1", name: "Granulated Sugar", qtyPerBatch: 1.5, unit: "kg" },
          { inventoryId: "dummy-eg-1", name: "Eggs (Grade A)", qtyPerBatch: 2, unit: "trays" },
          { inventoryId: "dummy-ub-1", name: "Unsalted Butter", qtyPerBatch: 1, unit: "kg" },
          { inventoryId: "dummy-fm-1", name: "Fresh Milk", qtyPerBatch: 3, unit: "L" },
          { inventoryId: "dummy-ve-1", name: "Vanilla Extract", qtyPerBatch: 100, unit: "ml" },
        ],
        packagingMaterials: [{ inventoryId: "dummy-bbs-1", name: "Bread Bags (Small)", qtyPerBatch: 500, unit: "pcs" }],
        decorationSupplies: [],
        linkedProduct: [],
        notes: "Standard pandesal recipe - yields ~500 pcs per batch",
      },
      {
        productId: "Loaf Bread",
        productName: "Loaf Bread",
        ingredients: [
          { inventoryId: "dummy-bf-2", name: "Bread Flour", qtyPerBatch: 15, unit: "kg" },
          { inventoryId: "dummy-gs-2", name: "Granulated Sugar", qtyPerBatch: 2, unit: "kg" },
          { inventoryId: "dummy-ub-2", name: "Unsalted Butter", qtyPerBatch: 1.5, unit: "kg" },
          { inventoryId: "dummy-eg-2", name: "Eggs (Grade A)", qtyPerBatch: 3, unit: "trays" },
          { inventoryId: "dummy-fm-2", name: "Fresh Milk", qtyPerBatch: 5, unit: "L" },
        ],
        packagingMaterials: [{ inventoryId: "dummy-bbl-1", name: "Bread Bags (Large)", qtyPerBatch: 200, unit: "pcs" }],
        decorationSupplies: [],
        linkedProduct: [],
        notes: "Classic loaf bread - yields ~200 loaves per batch",
      },
      {
        productId: "Choco Moist Cake",
        productName: "Choco Moist Cake",
        ingredients: [
          { inventoryId: "dummy-bf-3", name: "Bread Flour", qtyPerBatch: 5, unit: "kg" },
          { inventoryId: "dummy-cp-1", name: "Cocoa Powder", qtyPerBatch: 1.5, unit: "kg" },
          { inventoryId: "dummy-gs-3", name: "Granulated Sugar", qtyPerBatch: 4, unit: "kg" },
          { inventoryId: "dummy-ub-3", name: "Unsalted Butter", qtyPerBatch: 2, unit: "kg" },
          { inventoryId: "dummy-eg-3", name: "Eggs (Grade A)", qtyPerBatch: 4, unit: "trays" },
          { inventoryId: "dummy-fm-3", name: "Fresh Milk", qtyPerBatch: 3, unit: "L" },
          { inventoryId: "dummy-ve-2", name: "Vanilla Extract", qtyPerBatch: 50, unit: "ml" },
        ],
        packagingMaterials: [{ inventoryId: "dummy-cb-1", name: "Cake Boxes (8 in)", qtyPerBatch: 50, unit: "pcs" }],
        decorationSupplies: [{ inventoryId: "dummy-wc-1", name: "Whipping Cream", qtyPerBatch: 2, unit: "L" }],
        linkedProduct: [],
        notes: "Rich chocolate cake - yields ~50 cakes per batch",
      },
      {
        productId: "Sponge Fudge",
        productName: "Sponge Fudge",
        ingredients: [
          { inventoryId: "dummy-bf-4", name: "Bread Flour", qtyPerBatch: 4, unit: "kg" },
          { inventoryId: "dummy-cp-2", name: "Cocoa Powder", qtyPerBatch: 2, unit: "kg" },
          { inventoryId: "dummy-gs-4", name: "Granulated Sugar", qtyPerBatch: 5, unit: "kg" },
          { inventoryId: "dummy-ub-4", name: "Unsalted Butter", qtyPerBatch: 3, unit: "kg" },
          { inventoryId: "dummy-eg-4", name: "Eggs (Grade A)", qtyPerBatch: 5, unit: "trays" },
          { inventoryId: "dummy-fm-4", name: "Fresh Milk", qtyPerBatch: 2, unit: "L" },
        ],
        packagingMaterials: [{ inventoryId: "dummy-cb-2", name: "Cake Boxes (8 in)", qtyPerBatch: 40, unit: "pcs" }],
        decorationSupplies: [{ inventoryId: "dummy-wc-2", name: "Whipping Cream", qtyPerBatch: 3, unit: "L" }],
        linkedProduct: [],
        notes: "Dense fudge sponge - yields ~40 cakes per batch",
      },
      {
        productId: "Ensaymada",
        productName: "Ensaymada",
        ingredients: [
          { inventoryId: "dummy-bf-5", name: "Bread Flour", qtyPerBatch: 8, unit: "kg" },
          { inventoryId: "dummy-gs-5", name: "Granulated Sugar", qtyPerBatch: 2.5, unit: "kg" },
          { inventoryId: "dummy-ub-5", name: "Unsalted Butter", qtyPerBatch: 3, unit: "kg" },
          { inventoryId: "dummy-eg-5", name: "Eggs (Grade A)", qtyPerBatch: 6, unit: "trays" },
          { inventoryId: "dummy-fm-5", name: "Fresh Milk", qtyPerBatch: 2, unit: "L" },
        ],
        packagingMaterials: [{ inventoryId: "dummy-pb-1", name: "Pastry Boxes", qtyPerBatch: 120, unit: "pcs" }],
        decorationSupplies: [{ inventoryId: "dummy-wc-3", name: "Whipping Cream", qtyPerBatch: 1, unit: "L" }],
        linkedProduct: [],
        notes: "Classic ensaymada - yields ~120 pcs per batch",
      },
    ];
    await Promise.all(demoRecipes.map(r => db.upsertRecipe(r)));
  }


  // Finance seed data
  const existingPurchases = await db.fetchPurchases();
  if (existingPurchases.length === 0) {
    const [existingBills, existingRevenue, existingWaste] = await Promise.all([db.fetchBillsAndDues(), db.fetchRevenue(), db.fetchWasteLog()]);
    // const now = new Date().toISOString();
    const demoPurchases = [
      { id: `FIN-P-${Date.now()}-1`, supplierName: "Golden Mill", modeOfPayment: "check" as const, dateDelivered: "2026-05-25", particular: "Bread Flour 500kg", amount: 24000, dueDate: "2026-06-25", releasedDate: "2026-05-25", paymentStatus: "paid" as const, remarks: "Regular flour order" },
      { id: `FIN-P-${Date.now()}-2`, supplierName: "DairyCo", modeOfPayment: "cash" as const, dateDelivered: "2026-05-26", particular: "Fresh Milk 200L + Butter 50kg", amount: 38000, dueDate: "2026-06-10", releasedDate: "", paymentStatus: "unpaid" as const, remarks: "Weekly dairy supply" },
      { id: `FIN-P-${Date.now()}-3`, supplierName: "SweetSource", modeOfPayment: "online" as const, dateDelivered: "2026-05-24", particular: "Granulated Sugar 300kg", amount: 18600, dueDate: "2026-06-24", releasedDate: "2026-05-24", paymentStatus: "paid" as const, remarks: "" },
      { id: `FIN-P-${Date.now()}-4`, supplierName: "PackPro", modeOfPayment: "cash" as const, dateDelivered: "2026-05-27", particular: "Cake Boxes (8 inch) 1000pcs + Bread Bags 500pcs", amount: 12500, dueDate: "2026-06-11", releasedDate: "", paymentStatus: "unpaid" as const, remarks: "Packaging materials for June" },
      { id: `FIN-P-${Date.now()}-5`, supplierName: "Cacao Prime", modeOfPayment: "online" as const, dateDelivered: "2026-05-22", particular: "Cocoa Powder 50kg", amount: 19000, dueDate: "2026-06-22", releasedDate: "2026-05-22", paymentStatus: "paid" as const, remarks: "Premium cocoa for cakes" },
    ];
    const demoBills = [
      { id: `FIN-B-${Date.now()}-1`, dueDate: "2026-06-07", particular: "MERALCO - Electricity Bill (May)", amount: 45230, modeOfPayment: "online" as const, remarks: "Bakery + Office", status: "pending" as const, category: "utilities" as const, branch: "Cakes N Styles Gensan" },
      { id: `FIN-B-${Date.now()}-2`, dueDate: "2026-06-01", particular: "Shop Space Rent - June", amount: 80000, modeOfPayment: "check" as const, remarks: "Monthly rent for main bakery", status: "pending" as const, category: "rent" as const, branch: "Cakes N Styles Gensan" },
      { id: `FIN-B-${Date.now()}-3`, dueDate: "2026-06-15", particular: "PLDT Internet (May bill)", amount: 2500, modeOfPayment: "online" as const, remarks: "Fiber plan for office", status: "paid" as const, category: "internet" as const, branch: "Cakes N Styles Gensan" },
      { id: `FIN-B-${Date.now()}-4`, dueDate: "2026-06-05", particular: "Staff Payroll - Last Week May", amount: 120000, modeOfPayment: "cash" as const, remarks: "5 bakers + 3 deco + 2 kitchen + 2 branch staff", status: "pending" as const, category: "payroll" as const, branch: "Cakes N Styles Gensan" },
      { id: `FIN-B-${Date.now()}-5`, dueDate: "2026-06-10", particular: "Maynilad Water Bill", amount: 3450, modeOfPayment: "online" as const, remarks: "", status: "pending" as const, category: "utilities" as const, branch: "Shadrach's Bake & Brew" },
      { id: `FIN-B-${Date.now()}-6`, dueDate: "2026-06-20", particular: "Equipment Maintenance - Ovens", amount: 15000, modeOfPayment: "cash" as const, remarks: "Scheduled maintenance for 3 ovens", status: "pending" as const, category: "maintenance" as const, branch: "Cakes N Styles Gensan" },
    ];
    const demoRevenue = [
      { id: `FIN-R-${Date.now()}-1`, source: "branch_sales" as const, particular: "Daily Sales - May 30", branch: "Cakes N Styles Gensan", amount: 152500, date: "2026-05-30", modeOfPayment: "cash" as const, referenceId: "BR1-0530", remarks: "Saturday sales" },
      { id: `FIN-R-${Date.now()}-2`, source: "branch_sales" as const, particular: "Daily Sales - May 30", branch: "Shadrach's Bake & Brew", amount: 98750, date: "2026-05-30", modeOfPayment: "online" as const, referenceId: "BR2-0530", remarks: "" },
      { id: `FIN-R-${Date.now()}-3`, source: "delivery" as const, particular: "Bulk Order - City Cafe", branch: "Cakes N Styles Gensan", amount: 25000, date: "2026-05-29", modeOfPayment: "check" as const, referenceId: "DLV-BULK-001", remarks: "200 pcs Pandesal daily for 1 week" },
      { id: `FIN-R-${Date.now()}-4`, source: "branch_sales" as const, particular: "Daily Sales - May 29", branch: "Cakes N Styles Gensan", amount: 138200, date: "2026-05-29", modeOfPayment: "cash" as const, referenceId: "BR1-0529", remarks: "" },
      { id: `FIN-R-${Date.now()}-5`, source: "manual" as const, particular: "Custom Wedding Cake Order", branch: "Shadrach's Bake & Brew", amount: 45000, date: "2026-05-28", modeOfPayment: "online" as const, referenceId: "CUST-WED-001", remarks: "3-tier custom wedding cake" },
    ];
    const demoWaste = [
      { id: `FIN-W-${Date.now()}-1`, product: "Pandesal", qtyRejected: 15, unitCost: 48, totalCost: 720, reason: "Over-baked / burned bottom", source: "kitchen_qc", referenceId: "QC-0529-01", date: "2026-05-29" },
      { id: `FIN-W-${Date.now()}-2`, product: "Choco Moist Cake", qtyRejected: 2, unitCost: 600, totalCost: 1200, reason: "Cracked surface / uneven baking", source: "kitchen_qc", referenceId: "QC-0529-02", date: "2026-05-29" },
      { id: `FIN-W-${Date.now()}-3`, product: "Loaf Bread", qtyRejected: 5, unitCost: 48, totalCost: 240, reason: "Stale / not sold within 24hrs", source: "branch_return", referenceId: "BR1-RET-0530", date: "2026-05-30" },
      { id: `FIN-W-${Date.now()}-4`, product: "Ensaymada", qtyRejected: 8, unitCost: 35, totalCost: 280, reason: "Decoration fell off during transport", source: "kitchen_qc", referenceId: "QC-0530-01", date: "2026-05-30" },
    ];
    const seedPromises: Promise<void>[] = [];
    if (existingPurchases.length === 0) seedPromises.push(db.upsertPurchases(demoPurchases));
    if (existingBills.length === 0) seedPromises.push(db.upsertBillsAndDues(demoBills));
    if (existingRevenue.length === 0) seedPromises.push(db.upsertRevenue(demoRevenue));
    if (existingWaste.length === 0) seedPromises.push(db.upsertWasteLog(demoWaste));
    if (seedPromises.length > 0) await Promise.all(seedPromises);
  }
  const existing = await db.fetchAllInventory();
  if (existing.length > 0) return;

  const demoInventory: InventoryItem[] = [
    { id: "INV-001", name: "Eggs (Grade A)", sku: "EGG-30", unit: "trays", onHand: 42, threshold: 50, cost: 245, supplier: "Sunrise Farms", lastIn: "2026-05-24", category: "dairy", group: "ingredients", expiryDate: "2026-05-28" },
    { id: "INV-002", name: "Bread Flour", sku: "FLR-25", unit: "kg", onHand: 850, threshold: 200, cost: 48, supplier: "Golden Mill", lastIn: "2026-05-22", category: "dry", group: "ingredients", expiryDate: "2026-08-15" },
    { id: "INV-003", name: "Unsalted Butter", sku: "BTR-1", unit: "kg", onHand: 120, threshold: 40, cost: 420, supplier: "DairyCo", lastIn: "2026-05-23", category: "dairy", group: "ingredients", expiryDate: "2026-06-10" },
    { id: "INV-004", name: "Cocoa Powder", sku: "COC-5", unit: "kg", onHand: 65, threshold: 20, cost: 380, supplier: "Cacao Prime", lastIn: "2026-05-20", category: "dry", group: "ingredients", expiryDate: "2026-07-01" },
    { id: "INV-005", name: "Granulated Sugar", sku: "SUG-50", unit: "kg", onHand: 420, threshold: 100, cost: 62, supplier: "SweetSource", lastIn: "2026-05-21", category: "dry", group: "ingredients" },
    { id: "INV-006", name: "Fresh Milk", sku: "MLK-1L", unit: "L", onHand: 180, threshold: 60, cost: 85, supplier: "DairyCo", lastIn: "2026-05-24", category: "dairy", group: "ingredients", expiryDate: "2026-05-20" },
    { id: "INV-007", name: "Cake Boxes (8\")", sku: "PKG-8", unit: "pcs", onHand: 1250, threshold: 300, cost: 8.5, supplier: "PackPro", lastIn: "2026-05-18", category: "packaging", group: "packaging-materials" },
    { id: "INV-008", name: "Whipping Cream", sku: "CRM-1L", unit: "L", onHand: 30, threshold: 25, cost: 180, supplier: "DairyCo", lastIn: "2026-05-25", category: "dairy", group: "ingredients", expiryDate: "2026-05-27" },
    { id: "INV-009", name: "Vanilla Extract", sku: "VAN-500", unit: "ml", onHand: 15, threshold: 10, cost: 320, supplier: "FlavorHouse", lastIn: "2026-04-10", category: "dry", group: "ingredients", expiryDate: "2026-05-26" },
  ];

  const demoSOS: DOSItem[] = [
    { id: "DOS-1", product: "Pandesal", qty: 500, priority: "HIGH", status: "in-progress" },
    { id: "DOS-2", product: "Loaf Bread", qty: 200, priority: "MEDIUM", status: "in-progress" },
    { id: "DOS-3", product: "Choco Moist Cake", qty: 50, priority: "HIGH", status: "pending" },
    { id: "DOS-4", product: "Sponge Fudge", qty: 40, priority: "HIGH", status: "pending" },
    { id: "DOS-5", product: "Ensaymada", qty: 120, priority: "MEDIUM", status: "in-progress" },
  ];

  const demoProduction: ProductionTask[] = [
    { id: "PRD-1", product: "Pandesal", target: 500, completed: 380, assignedTo: "baker", status: "in-progress" },
    { id: "PRD-2", product: "Loaf Bread", target: 200, completed: 200, assignedTo: "baker", status: "completed" },
    { id: "PRD-3", product: "Choco Moist Cake", target: 50, completed: 15, assignedTo: "deco", status: "in-progress" },
    { id: "PRD-4", product: "Sponge Fudge", target: 40, completed: 0, assignedTo: "deco", status: "in-progress" },
    { id: "PRD-5", product: "Ensaymada", target: 120, completed: 90, assignedTo: "baker", status: "in-progress" },
  ];

  const demoDeliveries: Delivery[] = [
    { id: "DLV-101", branch: "Cakes N Styles Gensan", address: "123 GenSan St", contactNumber: "09171234567", assignedRider: "Juan", items: [{ product: "Pandesal", qty: 300 }, { product: "Loaf Bread", qty: 120 }], status: "in-transit", eta: "08:30", paymentStatus: "paid", modeOfPayment: "cash", notes: "" },
    { id: "DLV-102", branch: "Shadrach's Bake & Brew", address: "456 BGC Ave", contactNumber: "09181234567", assignedRider: "Pedro", items: [{ product: "Pandesal", qty: 200 }, { product: "Loaf Bread", qty: 80 }], status: "preparing", eta: "09:15", paymentStatus: "unpaid", modeOfPayment: "online", notes: "Fragile items" },
  ];

  await Promise.all([
    db.upsertInventory(demoInventory.map(i => ({ ...i, group: "ingredients" as const }))),
    db.upsertDOS(demoSOS),
    db.upsertProduction(demoProduction),
    db.upsertDeliveries(demoDeliveries),
  ]);

  // Product catalog
  const products = ["Pandesal", "Loaf Bread", "Choco Moist Cake", "Sponge Fudge", "Ensaymada"];
  const { error: catErr } = await supabase.from("product_catalog").insert(products.map(n => ({ name: n })));
  if (catErr && !catErr.message.includes("duplicate")) console.error("seed catalog error:", catErr);



}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<Role>("admin");
  const [displayName, setDisplayName] = useState("User");
  const [dataLoading, setDataLoading] = useState(true);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [dosItems, setDosItems] = useState<DOSItem[]>([]);
  const [production, setProduction] = useState<ProductionTask[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showDOSBuilder, setShowDOSBuilder] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<"branch1" | "branch2">("branch1");
  const [salesAmount, setSalesAmount] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [existingQuestion, setExistingQuestion] = useState("");
  const [existingAnswer, setExistingAnswer] = useState("");
  const userIdRef = useRef<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [productCatalog, setProductCatalog] = useState<string[]>(["Pandesal", "Loaf Bread", "Choco Moist Cake", "Sponge Fudge", "Ensaymada"]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [productPricing, setProductPricing] = useState<ProductPricing[]>([]);
  const [freezerItems, setFreezerItems] = useState<FreezerItem[]>([]);
  const [freezerHistory, setFreezerHistory] = useState<FreezerHistory[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [billsAndDues, setBillsAndDues] = useState<BillDue[]>([]);
  const [revenue, setRevenue] = useState<Revenue[]>([]);
  const [wasteLog, setWasteLog] = useState<WasteLog[]>([]);
  const [now, setNow] = useState(new Date());
  const prevDayRef = useRef(getPHToday());
  const [dosNotifs, setDosNotifs] = useState<{ id: string; message: string }[]>([]);
  const [readNotifs, setReadNotifs] = useState<Set<string>>(new Set());
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [newDOSIds, setNewDOSIds] = useState<Set<string>>(new Set());
  const seenDOS = useRef(new Set<string>());
  const syncReady = useRef(false);

  // Load all data from Supabase
  async function loadAllData(): Promise<DOSItem[]> {
    setDataLoading(true);
    try {
      const [inv, dos, prod, del, audit, catalog, rec, pricing, freezer, fHistory, purch, bills, rev, waste] = await Promise.all([
        db.fetchAllInventory(),
        db.fetchDOS(),
        db.fetchProduction(),
        db.fetchDeliveries(),
        db.fetchAuditLogs(),
        db.fetchProductCatalog(),
        db.fetchRecipes(),
        db.fetchProductPricing(),
        db.fetchFreezerItems(),
        db.fetchFreezerHistory(),
        db.fetchPurchases(),
        db.fetchBillsAndDues(),
        db.fetchRevenue(),
        db.fetchWasteLog(),
      ]);
      if (inv.length > 0) setInventory(inv);
      if (dos.length > 0) setDosItems(dos);
      if (prod.length > 0) setProduction(prod);
      if (del.length > 0) setDeliveries(del);
      setAuditLogs(audit);
      if (catalog.length > 0) setProductCatalog(catalog);
      if (rec.length > 0) setRecipes(rec);
      if (pricing.length > 0) setProductPricing(pricing);
      if (freezer.length > 0) setFreezerItems(freezer);
      else setFreezerItems(freezer);
      if (fHistory.length > 0) setFreezerHistory(fHistory);
      if (purch.length > 0) {
        const seen = new Set<string>();
        setPurchases(purch.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; }));
      } else { setPurchases(purch); }
      if (bills.length > 0) {
        const seen = new Set<string>();
        setBillsAndDues(bills.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; }));
      } else { setBillsAndDues(bills); }
      if (rev.length > 0) {
        const seen = new Set<string>();
        const deduped = rev.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
        const refMap = new Map<string, typeof deduped[0]>();
        for (const r of deduped) {
          if (r.referenceId) {
            const existing = refMap.get(r.referenceId);
            if (!existing || (r.createdAt || "") > (existing.createdAt || "") || (r.amount > existing.amount)) {
              refMap.set(r.referenceId, r);
            }
          }
        }
        setRevenue(deduped.filter(r => !r.referenceId || refMap.get(r.referenceId) === r));
      } else { setRevenue(rev); }
      if (waste.length > 0) {
        const seen = new Set<string>();
        setWasteLog(waste.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; }));
      } else { setWasteLog(waste); }
      return dos;
    } catch (err) {
      console.error("Failed to load data:", err);
      return [];
    } finally {
      setDataLoading(false);
    }
  }

  // Check for existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        userIdRef.current = session.user.id;
        const profile = await getProfile(session.user.id);
        setUserEmail(profile?.email || session.user.email || "");
        if (profile && profile.role) {
          setRole(profile.role);
          setDisplayName(profile.displayName);
          roleConfig[profile.role].name = profile.displayName;
          await seedIfEmpty();
          await db.migrateBranchNames();
          const loadedDOS = await loadAllData();
          // Activate any scheduled DOS for today (Philippines time)
          const today = getPHToday();
          const scheduled = loadedDOS.filter(i => i.status === "scheduled" && i.scheduledDate && i.scheduledDate <= today);
          if (scheduled.length > 0) {
            const updated = scheduled.map(i => ({ ...i, status: "pending" as const, scheduledDate: undefined }));
            const groupedMap = new Map<string, number>();
            updated.forEach(item => groupedMap.set(item.product, (groupedMap.get(item.product) || 0) + item.qty));
            const tasks: ProductionTask[] = [...groupedMap.entries()].map(([product, total], idx) => ({ id: `PRD-${Date.now()}-${idx}`, product, target: total, completed: 0, assignedTo: "baker" as const, status: "in-progress" as const }));
            await db.upsertDOS(updated);
            await db.upsertProduction(tasks);
            setDosItems(prev => prev.map(i => scheduled.find(s => s.id === i.id) ? { ...i, status: "pending", scheduledDate: undefined } : i));
            setProduction(prev => [...prev, ...tasks]);
            logAudit("SCHEDULED_ACTIVATED", `${scheduled.length} scheduled DOS item${scheduled.length > 1 ? "s" : ""} activated for today`);
          }
          setLoggedIn(true);
        }
      } else {
        setDataLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Real-time deliveries from Supabase
  useEffect(() => {
    if (!loggedIn) return;
    return db.subscribeDeliveries(() => {
      db.fetchDeliveries().then(setDeliveries).catch(console.error);
    });
  }, [loggedIn]);

  // Real-time freezer items from Supabase
  useEffect(() => {
    if (!loggedIn) return;
    return db.subscribeFreezer(() => {
      db.fetchFreezerItems().then(setFreezerItems).catch(console.error);
    });
  }, [loggedIn]);

  // Real-time production simulation
  useEffect(() => {
    if (!loggedIn) return;
    const interval = setInterval(async () => {
      const today = getPHToday();
      const prevDay = prevDayRef.current;

      // Midnight reset: archive yesterday's incomplete items
      if (today !== prevDay) {
        prevDayRef.current = today;
        setDosItems(prev => {
          const toComplete = prev.filter(i => i.status !== "scheduled" && i.status !== "completed");
          if (toComplete.length === 0) return prev;
          const completed = toComplete.map(i => ({ ...i, status: "completed" as const }));
          db.upsertDOS(completed).catch(console.error);
          logAudit("DAY_ROLLOVER", `${toComplete.length} incomplete DOS item${toComplete.length > 1 ? "s" : ""} auto-completed`);
          return prev.map(i => {
            const found = toComplete.find(t => t.id === i.id);
            return found ? { ...i, status: "completed" as const } : i;
          });
        });
      }

      // Activate scheduled DOS whose date has arrived
      setDosItems(prev => {
        const scheduled = prev.filter(i => i.status === "scheduled" && i.scheduledDate && i.scheduledDate <= today);
        if (scheduled.length === 0) return prev;
        const updated = scheduled.map(i => ({ ...i, status: "pending" as const, scheduledDate: undefined }));
        const groupMap = new Map<string, number>();
        updated.forEach(item => groupMap.set(item.product, (groupMap.get(item.product) || 0) + item.qty));
        const tasks: ProductionTask[] = [...groupMap.entries()].map(([product, total], idx) => ({
          id: `PRD-${Date.now()}-${idx}`,
          product,
          target: total,
          completed: 0,
          assignedTo: "baker" as const,
          status: "in-progress" as const,
        }));
        db.upsertDOS(updated).catch(console.error);
        db.upsertProduction(tasks).catch(console.error);
        setProduction(p => [...p, ...tasks]);
        logAudit("SCHEDULED_ACTIVATED", `${scheduled.length} scheduled DOS item${scheduled.length > 1 ? "s" : ""} activated for today`);
        return prev.map(i => {
          const found = scheduled.find(s => s.id === i.id);
          return found ? { ...i, status: "pending" as const, scheduledDate: undefined } : i;
        });
      });
      setProduction(prev => {
        const updated = prev.map(p => {
          if (p.status === "in-progress" && p.completed < p.target) {
            const increment = Math.floor(Math.random() * 4) + 1;
            const newCompleted = Math.min(p.completed + increment, p.target);
            return {
              ...p,
              completed: newCompleted,
              status: newCompleted >= p.target ? "completed" as const : p.status,
            };
          }
          return p;
        });
        // Persist changed tasks every tick for real-time sync
        const changed = updated.filter((u, i) => u.completed !== prev[i]?.completed);
        if (changed.length > 0) {
          db.upsertProduction(changed).catch(console.error);
        }
        return updated;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [loggedIn]);

  // Cross-tab sync: periodically fetch fresh data from Supabase
  useEffect(() => {
    if (!loggedIn) return;
    const sync = setInterval(async () => {
      try {
        const [dos, prod] = await Promise.all([db.fetchDOS(), db.fetchProduction()]);
        if (dos.length > 0) {
          if (!syncReady.current) {
            dos.forEach(d => seenDOS.current.add(d.id));
            syncReady.current = true;
            setDosItems(dos);
          } else {
            const newItems = dos.filter(d => !seenDOS.current.has(d.id));
            if (newItems.length > 0 && (role === "baker" || role === "deco")) {
              const myTasks = prod.filter(p => p.assignedTo === role);
              const relevant = newItems.filter(n => n.status !== "scheduled" && myTasks.some(t => t.product === n.product));
              if (relevant.length > 0) {
                const grouped = new Map<string, number>();
                relevant.forEach(r => grouped.set(r.product, (grouped.get(r.product) || 0) + r.qty));
                setDosNotifs(prev => [...prev, ...[...grouped.entries()].map(([product, total], i) => ({ id: `DOSNOTIF-${Date.now()}-${i}`, message: `New DOS: ${product} x${total}` }))]);
                setNewDOSIds(prev => { const next = new Set(prev); relevant.forEach(r => next.add(r.id)); return next; });
              }
            }
            newItems.forEach(d => seenDOS.current.add(d.id));
            setDosItems(dos);
          }
        }
        if (prod.length > 0) setProduction(prod);
      } catch {}
    }, 5000);
    return () => clearInterval(sync);
  }, [loggedIn, role]);

  const eggs = inventory.find(i => i.id === "INV-001");
  const isEggCritical = eggs ? eggs.onHand < eggs.threshold : false;

  const kpis = useMemo(() => {
    const totalProduction = production.reduce((sum, p) => sum + p.target, 0);
    const completedProduction = production.reduce((sum, p) => sum + p.completed, 0);
    const inventoryValue = inventory.reduce((sum, i) => sum + i.onHand * i.cost, 0);
    const lowStockCount = inventory.filter(i => i.onHand > 0 && i.onHand < i.threshold).length;
    const noStockCount = inventory.filter(i => i.onHand === 0).length;
    const now = new Date();
    const todayStr = getPHToday();
    const expiredCount = inventory.filter(i => i.expiryDate && i.expiryDate < todayStr).length;
    const expiringCount = inventory.filter(i => i.expiryDate && i.expiryDate >= todayStr && new Date(i.expiryDate).getTime() - now.getTime() <= 30 * 24 * 60 * 60 * 1000).length;
    return {
      productionRate: totalProduction > 0 ? Math.round((completedProduction / totalProduction) * 100) : 0,
      inventoryValue,
      lowStockCount,
      noStockCount,
      expiredCount,
      expiringCount,
      activeDeliveries: deliveries.filter(d => d.status !== "delivered").length,
    };
  }, [inventory, production, deliveries]);

  const handleLogin = async (selectedRole: Role, name: string) => {
    const user = await getCurrentUser();
    let display = name;
    if (user) {
      userIdRef.current = user.id;
      const existing = await getProfile(user.id);
      if (existing) {
        if (existing.displayName) display = existing.displayName;
        if (existing.email) setUserEmail(existing.email);
        await updateProfile(user.id, { role: selectedRole });
      } else {
        await updateProfile(user.id, { display_name: name, role: selectedRole });
      }
    }
    setRole(selectedRole);
    setDisplayName(display);
    roleConfig[selectedRole].name = display;
    setActiveTab("dashboard");
    setLoggedIn(true);
    logAudit("LOGIN", `${name} logged in as ${selectedRole}`);
    await seedIfEmpty();
    const loadedDOS = await loadAllData();
    // Activate any scheduled DOS for today (Philippines time)
    const today = getPHToday();
    const scheduled = loadedDOS.filter(i => i.status === "scheduled" && i.scheduledDate && i.scheduledDate <= today);
    if (scheduled.length > 0) {
      const updated = scheduled.map(i => ({ ...i, status: "pending" as const, scheduledDate: undefined }));
      const tasks: ProductionTask[] = updated.map((item, idx) => ({ id: `PRD-${Date.now()}-${idx}`, product: item.product, target: item.qty, completed: 0, assignedTo: "baker" as const, status: "in-progress" as const }));
      await db.upsertDOS(updated);
      await db.upsertProduction(tasks);
      setDosItems(prev => prev.map(i => scheduled.find(s => s.id === i.id) ? { ...i, status: "pending", scheduledDate: undefined } : i));
      setProduction(prev => [...prev, ...tasks]);
      logAudit("SCHEDULED_ACTIVATED", `${scheduled.length} scheduled DOS item${scheduled.length > 1 ? "s" : ""} activated for today`);
    }
  };

  const logAudit = (action: string, details: string) => {
    const entry = { timestamp: getPHTimestamp(), userName: displayName, role, action, details };
    db.addAuditLog(entry).catch(console.error);
    setAuditLogs(prev => [{ ...entry, id: `AUD-${Date.now()}-${prev.length}` }, ...prev]);
  };

  const handleLogout = async () => {
    await authSignOut();
    setLoggedIn(false);
    setRole("admin");
    setDisplayName("User");
  };

  const handleCompleteTask = async (taskId: string) => {
    setProduction(prev => {
      const updated = prev.map(p =>
        p.id === taskId ? { ...p, completed: p.target, status: "completed" as const } : p
      );
      const task = updated.find(p => p.id === taskId);
      if (task) {
        db.updateProduction(taskId, { completed: task.target, status: "completed" }).catch(console.error);
        logAudit("TASK_COMPLETE", `${task.product} (${task.target} pcs) — ${task.assignedTo}`);
      }
      return updated;
    });
  };

  const handleUpdateProduction = (taskId: string, updates: Partial<ProductionTask>) => {
    setProduction(prev => {
      const task = prev.find(p => p.id === taskId);
      if (task && updates.status === "in-progress") {
        logAudit("TASK_START", `${task.product} — ${task.assignedTo}`);
      }
      return prev.map(p => p.id === taskId ? { ...p, ...updates } as ProductionTask : p);
    });
    db.updateProduction(taskId, updates).catch(console.error);
  };

  const handleDOSCreate = async (items: DOSItem[], tasks: ProductionTask[]) => {
    const todayItems = items.filter(i => i.status !== "scheduled");
    const todayTasks = tasks.filter(t => todayItems.some(i => i.product === t.product));
    try {
      await db.upsertDOS(items);
      if (todayTasks.length > 0) await db.upsertProduction(todayTasks);
    } catch (err) {
      console.error("DOS save failed, but items will appear locally:", err);
    }
    setDosItems(prev => { items.forEach(i => seenDOS.current.add(i.id)); return [...prev, ...items]; });
    if (todayTasks.length > 0) setProduction(prev => [...prev, ...todayTasks]);
    setShowDOSBuilder(false);
    const scheduledCount = items.filter(i => i.status === "scheduled").length;
    logAudit("DOS_CREATED", `${items.length} item${items.length > 1 ? "s" : ""}${scheduledCount > 0 ? ` (${scheduledCount} scheduled)` : ""}`);
  };

  const handleAddProduct = async (product: InventoryItem) => {
    await db.upsertInventory([product]);
    setInventory(prev => [...prev, product]);
    logAudit("PRODUCT_ADDED", `${product.name} added to inventory`);
  };

  const handleEditDOS = async (item: DOSItem) => {
    try { await db.upsertDOS([item]); } catch (err) { console.error("DOS edit save failed:", err); }
    // Update production tasks to match the new roles
    const tsMatch = item.id.match(/^DOS-(\d+)-(\d+)$/);
    if (tsMatch) {
      const [, ts, idx] = tsMatch;
      const taskPrefix = `PRD-${ts}-${idx}-`;
      // Delete old production tasks for this DOS item
      const oldTasks = production.filter(t => t.id.startsWith(taskPrefix));
      if (oldTasks.length > 0) {
        await Promise.all(oldTasks.map(t => db.deleteProductionTask(t.id).catch(() => {})));
        setProduction(prev => prev.filter(t => !t.id.startsWith(taskPrefix)));
      }
      // Create new production tasks for the new roles
      const newRoles = item.roles || [];
      if (newRoles.length > 0) {
        const newTasks: ProductionTask[] = newRoles.map((role, roleIdx) => ({
          id: `${taskPrefix}${roleIdx}`,
          product: item.product,
          target: item.qty,
          completed: 0,
          assignedTo: role,
          status: "pending" as const,
        }));
        await db.upsertProduction(newTasks).catch(err => console.error("Production task upsert failed:", err));
        setProduction(prev => [...prev, ...newTasks]);
      }
    }
    setDosItems(prev => prev.map(d => d.id === item.id ? item : d));
    logAudit("DOS_EDITED", `${item.product} — ${item.id} — Roles: ${item.roles?.join(', ') || 'None'}`);
  };

  const handleDeleteDOS = async (id: string) => {
    const item = dosItems.find(d => d.id === id);
    try { await db.deleteDOSItem(id); } catch (err) { console.error("DOS delete failed:", err); }
    setDosItems(prev => prev.filter(d => d.id !== id));
    if (item) logAudit("DOS_DELETED", `${item.product} — ${item.id}`);
  };

  const handleInventoryUpdate = async (items: InventoryItem[]) => {
    await db.upsertInventory(items);
    setInventory(items);
  };

  const handleSalesSubmit = () => {
    if (!salesAmount) return;
    alert(`Sales report submitted for ${selectedBranch === "branch1" ? "Cakes N Styles Gensan" : "Shadrach's Bake & Brew"}: ₱${salesAmount}`);
    setSalesAmount("");
  };

  if (!loggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F6F1]">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-amber-600 to-orange-600 shadow-lg">
            <span className="text-[28px] font-bold text-white">B</span>
          </div>
          <div className="text-[16px] font-semibold text-zinc-900">BakeFlow ERP</div>
          <div className="mt-1 text-[13px] text-zinc-500">Loading your workspace...</div>
          <div className="mx-auto mt-4 h-1.5 w-32 rounded-full bg-zinc-200 overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-amber-500 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const currentRole = roleConfig[role];

  return (
    <div className="min-h-screen bg-[#F9F6F1] text-zinc-900 antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fragment+Mono:ital@0;1&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        * { font-variant-ligatures: common-ligatures; }
        html { scrollbar-gutter: stable; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: #D6CFC4; border-radius: 8px; }
      `}</style>

      {/* Top Navbar */}
      <div className="sticky top-0 z-40 border-b border-[#E8E0D5] bg-[#FFFCF7]/80 backdrop-blur-xl">
        <div className="flex h-[76px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-5">
            <button onClick={() => setSidebarOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-[#E8E0D5]/60 active:bg-[#E8E0D5] lg:hidden transition-all" title="Open menu">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-br from-amber-600 to-orange-600 sm:h-11 sm:w-11 sm:rounded-[12px] sm:shadow-sm">
                <svg className="h-5 w-5 sm:h-6 sm:w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14M5 8a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2M5 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/><path d="M7 13h.01M10 13h.01M13 13h.01M16 13h.01"/><path d="M7 16h.01M10 16h.01M13 16h.01M16 16h.01"/></svg>
              </div>
              <div className="text-[16px] font-semibold tracking-wide text-zinc-900 whitespace-nowrap" style={{ fontFamily: "Instrument Sans, system-ui" }}>BAKEFLOW ERP</div>
            </div>
            <div className="hidden md:flex items-center gap-3 pl-5 ml-1 border-l border-[#E8E0D5]">
              <div className={`h-2.5 w-2.5 rounded-full ${isEggCritical ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-[13px] text-zinc-600" style={{ fontFamily: "Fragment Mono, monospace" }}>
                {now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })} • {now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-zinc-100/60 px-3 py-1.5 border border-zinc-200/50">
              <div className={`h-2 w-2 rounded-full ${isEggCritical ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className="text-[12px] font-semibold text-zinc-700 whitespace-nowrap uppercase tracking-wider">{role === "admin" ? "Admin" : role.charAt(0).toUpperCase() + role.slice(1)}</span>
            </div>

            {/* Notification bell */}
            <div className="relative">
              <button onClick={() => setShowNotifications(v => !v)} className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#E8E0D5] bg-white text-zinc-400 hover:text-zinc-700 hover:border-zinc-300 transition-all" title="Notifications">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {(() => { const unreadDOS = dosNotifs.filter(n => !readNotifs.has(n.id)).length; const activeAlerts = role === "admin" ? kpis.lowStockCount + kpis.noStockCount + kpis.expiredCount + kpis.expiringCount - dismissedAlerts.size : 0; return (activeAlerts + unreadDOS) > 0; })() && (
                  <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{(role === "admin" ? kpis.lowStockCount + kpis.noStockCount + kpis.expiredCount + kpis.expiringCount - dismissedAlerts.size : 0) + dosNotifs.filter(n => !readNotifs.has(n.id)).length}</span>
                )}
              </button>
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-[#E8E0D5] bg-white shadow-xl shadow-black/5">
                    <div className="border-b border-[#E8E0D5] px-4 py-3">
                      <div className="text-[13px] font-semibold text-zinc-900">Notifications</div>
                    </div>
                    <div className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
                      {(() => {
                        const now = new Date();
                        const todayStr = now.toISOString().split("T")[0];
                        const isAdmin = role === "admin";
                        const alerts: { key: string; name: string; desc: string; icon: string; iconBg: string; iconColor: string }[] = isAdmin ? [
                          ...inventory.filter(i => i.onHand === 0).map(i => ({ key: "out-"+i.id, name: i.name, desc: "Out of stock — reorder needed", icon: "0", iconBg: "bg-zinc-100", iconColor: "text-zinc-500" })),
                          ...inventory.filter(i => i.onHand > 0 && i.onHand < i.threshold).map(i => ({ key: "low-"+i.id, name: i.name, desc: `${i.onHand}/${i.threshold} ${i.unit} — below threshold`, icon: "!", iconBg: "bg-red-100", iconColor: "text-red-600" })),
                          ...inventory.filter(i => i.expiryDate && i.expiryDate < todayStr).map(i => ({ key: "exp-"+i.id, name: i.name, desc: `Expired ${i.expiryDate} — dispose`, icon: "✕", iconBg: "bg-purple-100", iconColor: "text-purple-600" })),
                          ...inventory.filter(i => i.expiryDate && i.expiryDate >= todayStr && new Date(i.expiryDate).getTime() - now.getTime() <= 30 * 24 * 60 * 60 * 1000).map(i => ({ key: "expg-"+i.id, name: i.name, desc: `Expires ${i.expiryDate} — use within 30 days`, icon: "~", iconBg: "bg-amber-100", iconColor: "text-amber-600" })),
                        ] : [];
                        const total = alerts.length + dosNotifs.length;
                        if (total === 0) return <div className="px-4 py-6 text-center text-[13px] text-zinc-400">No notifications</div>;
                        return <>
                          {dosNotifs.map(n => {
                            const read = readNotifs.has(n.id);
                            return (
                              <div key={n.id} onClick={() => setReadNotifs(prev => { const next = new Set(prev); if (next.has(n.id)) next.delete(n.id); else next.add(n.id); return next; })} className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-all ${read ? "bg-white opacity-50" : "bg-blue-50/50"}`}>
                                <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold ${read ? "bg-zinc-100 text-zinc-400" : "bg-blue-100 text-blue-600"}`}>{read ? "✓" : "+"}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-medium text-zinc-900">{n.message}</div>
                                  <div className="text-[12px] text-zinc-500">New DOS assigned to you</div>
                                </div>
                              </div>
                            );
                          })}
                          {alerts.map(a => {
                            const dim = dismissedAlerts.has(a.key);
                            return (
                              <div key={a.key} onClick={() => setDismissedAlerts(prev => { const next = new Set(prev); if (next.has(a.key)) next.delete(a.key); else next.add(a.key); return next; })} className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-all ${dim ? "bg-white opacity-40" : ""}`}>
                                <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold ${a.iconBg} ${a.iconColor}`}>{a.icon}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-medium text-zinc-900">{a.name}</div>
                                  <div className="text-[12px] text-zinc-500">{a.desc}</div>
                                </div>
                              </div>
                            );
                          })}
                        </>;
                      })()}
                    </div>
                    <div className="border-t border-[#E8E0D5] px-4 py-2.5 text-center">
                      <span className="text-[11px] text-zinc-400">{dosNotifs.length + (role === "admin" ? kpis.lowStockCount + kpis.noStockCount + kpis.expiredCount + kpis.expiringCount : 0)} notification{(dosNotifs.length + (role === "admin" ? kpis.lowStockCount + kpis.noStockCount + kpis.expiredCount + kpis.expiringCount : 0)) !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Logout */}
            <button onClick={handleLogout} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#E8E0D5] bg-white text-zinc-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all" title="Log out">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1600px]">
        {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

        <aside className={`fixed bottom-0 left-0 top-[76px] z-40 w-[280px] shrink-0 border-r border-[#E8E0D5] bg-[#FFFCF7] backdrop-blur-xl transition-transform duration-300 lg:sticky lg:block lg:translate-x-0 h-[calc(100vh-76px)] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex h-full flex-col p-4 pt-8 overflow-y-auto">
            <div className="mb-6 px-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500" style={{ fontFamily: "Fragment Mono, monospace" }}>{role === "admin" ? "Administrator" : role.charAt(0).toUpperCase() + role.slice(1)}</div>
              <div className="mt-1 text-[16px] font-semibold text-zinc-900">{displayName}</div>
            </div>

            <div className="mb-3 px-3">
              <div className="flex items-center gap-2">
                <span className="h-px flex-1 bg-[#E8E0D5]" />
                <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-400" style={{ fontFamily: "Fragment Mono, monospace" }}>Menu</span>
                <span className="h-px flex-1 bg-[#E8E0D5]" />
              </div>
            </div>

            <nav className="space-y-1">
              {sidebarItems[role].map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all ${
                    activeTab === item.id
                      ? 'bg-zinc-900 text-white shadow-md shadow-zinc-900/10'
                      : 'text-zinc-700 hover:bg-white hover:shadow-sm'
                  }`}
                >
                  {item.icon && (
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[16px] leading-none ${
                      activeTab === item.id ? 'bg-white/10' : 'bg-zinc-100'
                    }`}>
                      <span className={activeTab === item.id ? 'opacity-100' : 'opacity-60'}>{item.icon}</span>
                    </span>
                  )}
                  <span className="text-[14px] font-medium" style={{ fontFamily: "Instrument Sans, system-ui" }}>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-auto border-t border-[#E8E0D5] pt-3">
              <button onClick={async () => {
                setSidebarOpen(false);
                const uid = userIdRef.current;
                if (uid) { const sq = await db.getSecurityQuestionByUserId(uid); setExistingQuestion(sq?.question ?? ""); setExistingAnswer(sq?.answer ?? ""); }
                setShowSettings(true);
              }} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-zinc-500 hover:bg-white hover:shadow-sm hover:text-zinc-700 transition-all">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-[16px] leading-none opacity-60">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                </span>
                <span className="text-[14px] font-medium" style={{ fontFamily: "Instrument Sans, system-ui" }}>Settings</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="p-4 sm:p-6 lg:p-8">
            {role === "admin" && ["dashboard", "dos", "products", "pricing", "warehouse", "production", "deliveries", "audit", "finance"].includes(activeTab) && (
              <AdminDashboard
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                inventory={inventory}
                onUpdateInventory={handleInventoryUpdate}
                dosItems={dosItems}
                production={production}
                onUpdateProduction={handleUpdateProduction}
                deliveries={deliveries}
                auditLogs={auditLogs}
                kpis={kpis}
                onOpenDOSBuilder={() => setShowDOSBuilder(true)}
                onCreateDOS={handleDOSCreate}
                onAddProduct={handleAddProduct}
                onEditDOS={handleEditDOS}
                onDeleteDOS={handleDeleteDOS}
                productCatalog={productCatalog}
                onUpdateProductCatalog={setProductCatalog}
                recipes={recipes}
                onUpdateRecipes={setRecipes}
                onAddAuditLog={logAudit}
                onUpdateDeliveries={setDeliveries}
                productPricing={productPricing}
                onUpdateProductPricing={setProductPricing}
                freezerItems={freezerItems}
                onUpdateFreezer={setFreezerItems}
                purchases={purchases}
                onUpdatePurchases={setPurchases}
                billsAndDues={billsAndDues}
                onUpdateBillsAndDues={setBillsAndDues}
                revenue={revenue}
                onUpdateRevenue={setRevenue}
                wasteLog={wasteLog}
                onUpdateWasteLog={setWasteLog}
              />
            )}
            {role === "baker" && ["dashboard", "freezer"].includes(activeTab) && (
              <BakerDashboard production={production} dosItems={dosItems} onCompleteTask={handleCompleteTask} activeTab={activeTab} productCatalog={productCatalog} recipes={recipes} newDOSIds={newDOSIds} onMarkDOSSeen={(ids) => setNewDOSIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; })} freezerItems={freezerItems} onUpdateFreezer={setFreezerItems} freezerHistory={freezerHistory} inventory={inventory} />
            )}
            {role === "deco" && ["dashboard", "free-mix", "advanced-premix", "deco-queue", "custom-orders", "freezer"].includes(activeTab) && (
              <DecoDashboard production={production} dosItems={dosItems} onCompleteTask={handleCompleteTask} activeTab={activeTab} setActiveTab={setActiveTab} productCatalog={productCatalog} recipes={recipes} newDOSIds={newDOSIds} onMarkDOSSeen={(ids) => setNewDOSIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; })} inventory={inventory} onUpdateInventory={setInventory} onUpdateRecipes={setRecipes} onAddAuditLog={logAudit} freezerItems={freezerItems} onUpdateFreezer={setFreezerItems} freezerHistory={freezerHistory} />
            )}
            {role === "kitchen" && ["dashboard", "queue", "qc"].includes(activeTab) && (
              <KitchenDashboard production={production} deliveries={deliveries} dosItems={dosItems} onUpdateDeliveries={setDeliveries} activeTab={activeTab} />
            )}
            {role === "branch" && activeTab === "dashboard" && (
              <BranchDashboard
                selectedBranch={selectedBranch}
                onBranchChange={setSelectedBranch}
                salesAmount={salesAmount}
                onSalesAmountChange={setSalesAmount}
                onSubmitSales={handleSalesSubmit}
              />
            )}
            {role === "pastry" && ["dashboard", "recipes", "queue", "freezer"].includes(activeTab) && (
              <PastryDashboard production={production} dosItems={dosItems} activeTab={activeTab} recipes={recipes} freezerItems={freezerItems} onUpdateFreezer={setFreezerItems} freezerHistory={freezerHistory} />
            )}
          </div>
        </main>
      </div>

      {showDOSBuilder && (
        <DOSBuilderModal
          onClose={() => setShowDOSBuilder(false)}
          onSave={handleDOSCreate}
          productCatalog={productCatalog}
          onAddToCatalog={(name) => {
            setProductCatalog(prev => prev.includes(name) ? prev : [...prev, name]);
            db.addToCatalog(name).catch(console.error);
          }}
          hasTodayItems={dosItems.some(i => i.status !== "scheduled")}
          scheduledDates={new Set(dosItems.filter(i => i.status === "scheduled" && i.scheduledDate).map(i => i.scheduledDate!))}
        />
      )}

      {showSettings && <SettingsModal
        currentName={displayName}
        currentEmail={userEmail}
        currentQuestion={existingQuestion}
        currentAnswer={existingAnswer}
        onClose={() => setShowSettings(false)}
        onSave={async ({ name, email, password, securityQuestion, securityAnswer }) => {
          const uid = userIdRef.current;
          if (!uid) return;
          try {
            const profUpdates: { display_name?: string; email?: string } = {};
            if (name !== displayName) profUpdates.display_name = name;
            if (email !== userEmail) {
              profUpdates.email = email;
            }
            if (Object.keys(profUpdates).length > 0) {
              await updateProfile(uid, profUpdates);
            }
            if (name !== displayName) setDisplayName(name);
            if (email !== userEmail) setUserEmail(email);
            if (password) {
              try { await updatePassword(password); } catch (e: any) { console.error("updatePassword failed:", e.message); }
            }
            if (securityQuestion && securityAnswer) {
              await db.saveSecurityQuestion(uid, securityQuestion, securityAnswer, password || undefined);
            }
            logAudit("PROFILE_UPDATED", "User updated their profile");
            setShowSettings(false);
          } catch (e: any) {
            alert(e.message || "Failed to update profile");
          }
        }}
      />}
    </div>
  );
}

function SettingsModal({ currentName, currentEmail, currentQuestion, currentAnswer, onClose, onSave }: {
  currentName: string;
  currentEmail: string;
  currentQuestion: string;
  currentAnswer: string;
  onClose: () => void;
  onSave: (vals: { name: string; email: string; password: string; securityQuestion: string; securityAnswer: string }) => Promise<void>;
}) {
  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState(currentQuestion || "");
  const [securityAnswer, setSecurityAnswer] = useState(currentAnswer || "");
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSecurityQuestion(currentQuestion || "");
    setSecurityAnswer(currentAnswer || "");
  }, [currentQuestion, currentAnswer]);

  const securityQuestions = [
    "What was your childhood nickname?",
    "What is the name of your first pet?",
    "What was the make of your first car?",
    "What elementary school did you attend?",
    "What is your mother's maiden name?",
    "What city were you born in?",
    "What is your favorite book?",
  ];

  const handleSave = async () => {
    setError("");
    if (password && confirmPassword && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await onSave({ name, email, password, securityQuestion, securityAnswer });
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-[#E8E0D5] bg-white px-3 py-2 pr-10 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#E8E0D5] bg-white p-6 shadow-xl shadow-black/10 max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Settings</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-all">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-zinc-600">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-zinc-600">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" className={inputClass} />
          </div>

          <div className="border-t border-[#E8E0D5] pt-4">
            <button type="button" onClick={() => { setShowPasswordSection(v => !v); if (showPasswordSection) { setPassword(""); setConfirmPassword(""); } }} className="flex w-full items-center justify-between text-left mb-3">
              <span className="text-[13px] font-semibold text-zinc-700">Change Password</span>
              <svg className={`h-4 w-4 text-zinc-400 transition-transform ${showPasswordSection ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showPasswordSection && <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-zinc-600">New Password</label>
                <div className="relative">
                  <input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} placeholder="Enter new password" className={inputClass} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-all">
                    {showPassword ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-zinc-600">Confirm Password</label>
                <div className="relative">
                  <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type={showConfirm ? "text" : "password"} placeholder="Re-enter new password" className={inputClass} />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-all">
                    {showConfirm ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>}
          </div>

          <div className="border-t border-[#E8E0D5] pt-4">
            <h3 className="mb-3 text-[13px] font-semibold text-zinc-700">Security Question (for password recovery)</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-zinc-600">Question</label>
                <select value={securityQuestion} onChange={e => setSecurityQuestion(e.target.value)} className="w-full rounded-lg border border-[#E8E0D5] bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all">
                  <option value="">-- Select a question --</option>
                  {securityQuestions.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-zinc-600">Answer</label>
                <input value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} type="text" placeholder="Your answer" className={inputClass.replace("pr-10", "")} />
              </div>
            </div>
          </div>
        </div>

        {error && <div className="mt-3 text-[13px] text-red-500">{error}</div>}

        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose} className="rounded-lg border border-[#E8E0D5] bg-white px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-all">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </>
  );
}
