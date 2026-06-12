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
  source?: "production-prep" | "manual";
};

export type DOSItem = {
  id: string;
  product: string;
  qty: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "pending" | "in-progress" | "completed" | "scheduled";
  scheduledDate?: string;
  roles?: ("baker" | "pastry" | "deco")[];
  flavor?: string;
  size?: string;
  themeOccasion?: string;
  colorScheme?: string;
  cakeDesignNotes?: string;
  topper?: string;
  referenceImage?: string;
  messageCaption?: string;
};

export type ProductionTask = {
  id: string;
  product: string;
  target: number;
  completed: number;
  assignedTo: "baker" | "deco" | "kitchen" | "pastry";
  status: "pending" | "in-progress" | "completed";
  dateAssigned?: string;
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
  paymentStatus: "unpaid" | "paid" | "half";
  modeOfPayment: "cash" | "check" | "online" | "bank";
  notes: string;
  date?: string;
  totalAmount?: number;
};

export type AuditLog = {
  id: string;
  timestamp: string;
  userName: string;
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
  linkedIngredients?: string[];
  group?: string;
  yield?: number;
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

export type FreezerItemIngredients = {
  standard: { name: string; qtyPerBatch: number; unit: string; totalUsed: number }[];
  additional: { name: string; qty: number; unit: string; reason: string }[];
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
  ingredients?: FreezerItemIngredients;
  size?: string;
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

export type PromoPackageItem = {
  productName: string;
  qty: number;
};

export type PromoPackage = {
  id: string;
  name: string;
  description: string;
  type: "promo" | "package";
  items: PromoPackageItem[];
  originalPrice: number;
  promoPrice: number;
  status: "active" | "inactive" | "expired";
  startDate?: string;
  endDate?: string;
  createdAt?: string;
};

export type PastryAssemblyTask = {
  id: string;
  dosId?: string;
  promoId?: string;
  productName: string;
  promoType: "promo" | "package" | "normal";
  components: { productName: string; qty: number; sourceFreezerId: string }[];
  targetQty: number;
  assembledQty: number;
  status: "pending" | "accepted" | "in_progress" | "completed" | "cancelled";
  assembledBy: string;
  qcChecklist?: Record<string, boolean>;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

// ─── Production Calculation Engine ───

export type RecipeDemand = {
  recipeName: string;
  recipeYield: number;
  demandedBy: { productName: string; qty: number }[];
  totalDemand: number;
};

export type BatchCalculation = {
  recipeName: string;
  totalDemand: number;
  recipeYield: number;
  batchesNeeded: number;
  expectedOutput: number;
  netDemand: number;
  requiredIngredients: {
    name: string;
    qtyPerBatch: number;
    totalQty: number;
    unit: string;
    inventoryId: string;
  }[];
  requiredPackaging: {
    name: string;
    qtyPerBatch: number;
    totalQty: number;
    unit: string;
    inventoryId: string;
  }[];
  requiredDeco: {
    name: string;
    qtyPerBatch: number;
    totalQty: number;
    unit: string;
    inventoryId: string;
  }[];
};

export type OutputAllocation = {
  recipeName: string;
  producedQty: number;
  allocations: {
    productName: string;
    demandQty: number;
    allocatedQty: number;
    priority: number;
  }[];
};

export type ProductionPlan = {
  id: string;
  date: string;
  dosItems: DOSItem[];
  recipeDemands: RecipeDemand[];
  batchCalculations: BatchCalculation[];
  outputAllocations: OutputAllocation[];
  status: "draft" | "confirmed" | "in-progress" | "completed";
  createdBy: string;
  createdAt: string;
  confirmedAt?: string;
};
