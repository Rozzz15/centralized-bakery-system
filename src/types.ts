export type Role = "admin" | "baker" | "deco" | "kitchen" | "branch";

export type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  onHand: number;
  threshold: number;
  cost: number;
  supplier: string;
  lastIn: string;
  category: "dry" | "dairy" | "produce" | "packaging";
  expiryDate?: string;
};

export type DOSItem = {
  id: string;
  product: string;
  qty: number;
  branch1: number;
  branch2: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "pending" | "in-progress" | "completed" | "scheduled";
  scheduledDate?: string;
};

export type ProductionTask = {
  id: string;
  product: string;
  target: number;
  completed: number;
  assignedTo: "baker" | "deco" | "kitchen";
  status: "pending" | "in-progress" | "completed";
};

export type Delivery = {
  id: string;
  branch: string;
  items: { product: string; qty: number; source?: string }[];
  status: "preparing" | "in-transit" | "delivered";
  eta: string;
};

export type AuditLog = {
  id: string;
  timestamp: string;
  user: string;
  role: Role;
  action: string;
  details: string;
};

export type KPIs = {
  productionRate: number;
  inventoryValue: number;
  lowStockCount: number;
  noStockCount: number;
  expiredCount: number;
  expiringCount: number;
  activeDeliveries: number;
};

export type VerificationResult = {
  taskId: string;
  product: string;
  source: string;
  qtyReceived: number;
  qtyPassed: number;
  qtyRejected: number;
  qualityOk: boolean;
  consistencyOk: boolean;
  notes: string;
  status: "pending" | "verified" | "rejected";
};

export type BranchBatch = {
  id: string;
  branch: "Branch 1 - Makati" | "Branch 2 - BGC";
  items: { product: string; qty: number; source?: string }[];
  status: "consolidating" | "packaged" | "dispatched";
};

export type DeliveryReport = {
  id: string;
  batchId: string;
  branch: string;
  items: { product: string; qty: number; source?: string }[];
  createdAt: string;
  status: "draft" | "submitted" | "approved";
  totalOutput: number;
  batchRef: string;
};

export type KitchenFeedback = {
  id: string;
  product: string;
  issue: string;
  severity: "minor" | "major" | "critical";
  reportedAt: string;
  resolved: boolean;
};

export type MaterialRequest = {
  id: string;
  items: { name: string; qty: number; unit: string }[];
  status: "draft" | "pending-approval" | "approved" | "released" | "cancelled";
  createdAt: string;
};

export type DecoQCResult = {
  batchId: string;
  product: string;
  batchCountOk: boolean;
  ingredientUsageOk: boolean;
  decorationConsistent: boolean;
  notes: string;
  status: "passed" | "failed";
};

export type DecoSubTask = {
  id: string;
  product: string;
  batchCount: number;
  assignedTo: string;
  status: "pending" | "in-progress" | "completed";
  dosRef: string;
};

export type BakerIngredientRequest = {
  id: string;
  items: { name: string; qty: number; unit: string }[];
  status: "draft" | "pending-approval" | "approved" | "released" | "cancelled";
  createdAt: string;
};

export type StockTransaction = {
  id: string;
  type: "in" | "out";
  itemName: string;
  itemId: string;
  qty: number;
  unit: string;
  reference: string;
  timestamp: string;
  target?: "baker" | "deco";
};

export type DeliveryValidation = {
  id: string;
  reportId: string;
  branch: string;
  items: { product: string; qty: number; source?: string }[];
  status: "pending" | "validated" | "posted";
  timestamp: string;
};

export type RecipeIngredient = {
  inventoryId: string;
  name: string;
  qtyPerBatch: number;
  unit: string;
};

export type ProductRecipe = {
  productId: string;
  productName: string;
  ingredients: RecipeIngredient[];
};
