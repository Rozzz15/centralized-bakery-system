export type Role = "admin" | "baker" | "deco" | "kitchen" | "branch" | "pastry";

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
  group: "ingredients" | "packaging-materials" | "decoration-supplies" | "operational-supplies";
  expiryDate?: string;
  accessRoles?: Role[];
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
  assignedTo: "baker" | "deco" | "kitchen" | "pastry";
  status: "pending" | "in-progress" | "completed";
};

export type Delivery = {
  id: string;
  branch: string;
  address: string;
  contactNumber: string;
  assignedRider: string;
  items: { product: string; qty: number; source?: string }[];
  status: "preparing" | "in-transit" | "delivered";
  eta: string;
  paymentStatus: "unpaid" | "paid" | "cod";
  notes: string;
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
  branch: "Cakes N Styles Gensan" | "Shadrach's Bake & Brew";
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
  group?: string;
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
  id?: string;
  productId: string;
  productName: string;
  ingredients: RecipeIngredient[];
  packagingMaterials: RecipeIngredient[];
  decorationSupplies: RecipeIngredient[];
  notes?: string;
  linkedProduct?: string[];
};

export type ProductPricingVariant = {
  id: string;
  size: string;
  sellingPrice: number;
  wholesalePrice: number;
};

export type ProductPricing = {
  id: string;
  productName: string;
  category: string;
  estimatedCost: number;
  sellingPrice: number;
  wholesalePrice: number;
  profitMargin: number;
  status: "active" | "draft" | "archived";
  variants: ProductPricingVariant[];
};

export type FreezerItem = {
  id: string;
  productName: string;
  qty: number;
  unit: string;
  batchRef: string;
  producedBy: string;
  dateProduced: string;
  status: "stored" | "dispatched" | "expired";
  notes?: string;
};

export type FreezerHistory = {
  id: string;
  productName: string;
  producedBy: string;
  qtyChanged: number;
  action: string;
  reference: string;
  timestamp: string;
};

export type Purchase = {
  id: string;
  supplierName: string;
  modeOfPayment: string;
  dateDelivered: string;
  particular: string;
  amount: number;
  dueDate: string;
  releasedDate: string;
  paymentStatus: string;
  remarks: string;
  createdAt?: string;
};

export type BillDue = {
  id: string;
  dueDate: string;
  particular: string;
  amount: number;
  modeOfPayment: string;
  remarks: string;
  status: string;
  category: string;
  branch: string;
  createdAt?: string;
};

export type Revenue = {
  id: string;
  source: string;
  particular: string;
  branch: string;
  amount: number;
  date: string;
  modeOfPayment: string;
  referenceId: string;
  remarks: string;
  createdAt?: string;
};

export type WasteLog = {
  id: string;
  product: string;
  qtyRejected: number;
  unitCost: number;
  totalCost: number;
  reason: string;
  source: string;
  referenceId: string;
  date: string;
  createdAt?: string;
};
