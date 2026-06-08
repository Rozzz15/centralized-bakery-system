# Production Calculation Engine — Implementation Plan

## 🎯 Overview

New layer for the Deco Account that transforms the current DOS → Product → Recipe flow into a **recipe-centric production planning system** with yield-based batch calculation and buffer stock tracking.

**Core Formula:**
```
DOS → Group by Recipe → Apply Yield → Calculate Batches → Allocate Output → Track Buffer
```

---

## 📊 Current System Analysis

### Current Flow (What Exists)
```
1. Admin creates DOS items (Product × Qty)
2. Deco sees DOS items per product
3. Each product has a recipe (or linked recipes via linkedIngredients)
4. Pre-Mix: Deduct ingredients per product recipe
5. Advanced Premix: Fine-tune compositions
6. Decoration Queue: Decorate and finish
7. Freezer: Store finished goods
```

### Current Data Model
```typescript
// ProductRecipe already has:
type ProductRecipe = {
  yield?: number;  // ✅ Already added — how many pcs per batch
  linkedIngredients?: string[];  // Links to sub-recipes
  // ... other fields
};

// DOS items are product-level:
type DOSItem = {
  product: string;  // Product name
  qty: number;      // Quantity needed
  // ...
};
```

### The Problem
- Current system thinks in **product units** (Burger Bun = 15, Cake = 10)
- Baker actually produces at **recipe level** (Recipe A yields 27 pcs)
- No batch calculation logic
- No buffer stock tracking
- Excess is treated as waste, not reusable inventory

---

## 🏗️ New Architecture

### Component: Production Plan Panel

**Location in Deco Dashboard:** New tab or section between "DOS Received" and "Pre-Mix"

**New Flow:**
```
Step 1: DOS Received (unchanged)
Step 2: Production Plan Panel (NEW) ← Shows aggregated recipe demand + batch calculations
Step 3: Pre-Mix (enhanced — uses batch plan)
Step 4: Advanced Premix (unchanged)
Step 5: Decoration Queue (unchanged)
Step 6: Freezer (enhanced — includes buffer stock tab)
```

---

## 📐 New Types

### 1. Recipe Demand Aggregator
```typescript
type RecipeDemand = {
  recipeName: string;           // e.g., "Basic Bread Dough"
  recipeYield: number;          // e.g., 27 (pcs per batch)
  demandedBy: {                 // Which DOS products need this recipe
    productName: string;        // e.g., "Burger Bun"
    qty: number;                // e.g., 15
  }[];
  totalDemand: number;          // Sum of all demandedBy.qty = 25
};
```

### 2. Batch Calculation
```typescript
type BatchCalculation = {
  recipeName: string;
  totalDemand: number;          // 25
  recipeYield: number;          // 27
  batchesNeeded: number;        // Math.ceil(25 / 27) = 1
  expectedOutput: number;       // 1 × 27 = 27
  requiredIngredients: {        // Scaled by batchesNeeded
    name: string;
    qtyPerBatch: number;
    totalQty: number;           // qtyPerBatch × batchesNeeded
    unit: string;
    inventoryId: string;
  }[];
};
```

### 3. Output Allocation
```typescript
type OutputAllocation = {
  recipeName: string;
  producedQty: number;          // 27 (from batch production)
  allocations: {
    productName: string;        // e.g., "Burger Bun"
    demandQty: number;          // 15 (from DOS)
    allocatedQty: number;       // 15
    priority: number;           // Order of allocation
  }[];
  bufferStock: number;          // 27 - 15 - 10 = 2 (excess)
};
```

### 4. Buffer Stock Entry
```typescript
type BufferStockEntry = {
  id: string;
  recipeName: string;
  productName?: string;         // If allocated to specific product
  qty: number;                  // Buffer quantity
  unit: string;
  source: "production-plan";    // Origin
  batchRef: string;             // Reference to production batch
  dateCreated: string;
  status: "available" | "used" | "expired";
  usedIn?: string;              // DOS ID or production plan that consumed it
};
```

### 5. Production Plan (Master Record)
```typescript
type ProductionPlan = {
  id: string;
  date: string;                 // Production date
  dosItems: DOSItem[];          // Original DOS items
  recipeDemands: RecipeDemand[];  // Aggregated demands
  batchCalculations: BatchCalculation[];  // Batch calculations
  outputAllocations: OutputAllocation[];  // Output splits
  bufferStockCreated: BufferStockEntry[]; // Buffer stock generated
  bufferStockUsed: {            // Buffer stock consumed
    bufferId: string;
    usedFor: string;            // Product or DOS item
    qtyUsed: number;
  }[];
  status: "draft" | "confirmed" | "in-progress" | "completed";
  createdBy: string;
  createdAt: string;
  confirmedAt?: string;
};
```

---

## 🧩 New Components

### Component 1: RecipeDemandAggregator
**Purpose:** Groups DOS items by recipe, calculates total demand per recipe

**Props:**
- `dosItems: DOSItem[]`
- `recipes: ProductRecipe[]`

**Output:**
- `RecipeDemand[]` — Aggregated demand per recipe

**Logic:**
```typescript
function aggregateRecipeDemand(dosItems: DOSItem[], recipes: ProductRecipe[]): RecipeDemand[] {
  const demandMap = new Map<string, RecipeDemand>();
  
  dosItems.forEach(dos => {
    // Find recipe for this product
    const recipe = recipes.find(r => r.productName === dos.product);
    if (!recipe) return;
    
    const recipeName = recipe.productName;
    if (!demandMap.has(recipeName)) {
      demandMap.set(recipeName, {
        recipeName,
        recipeYield: recipe.yield ?? 1,
        demandedBy: [],
        totalDemand: 0,
      });
    }
    
    const demand = demandMap.get(recipeName)!;
    demand.demandedBy.push({ productName: dos.product, qty: dos.qty });
    demand.totalDemand += dos.qty;
  });
  
  return Array.from(demandMap.values());
}
```

### Component 2: BatchCalculator
**Purpose:** Applies yield logic to calculate batches needed

**Props:**
- `recipeDemands: RecipeDemand[]`
- `recipes: ProductRecipe[]`
- `inventory: InventoryItem[]`

**Output:**
- `BatchCalculation[]` — Batch requirements with ingredient scaling

**Logic:**
```typescript
function calculateBatches(demand: RecipeDemand, recipe: ProductRecipe, inventory: InventoryItem[]): BatchCalculation {
  const batchesNeeded = Math.ceil(demand.totalDemand / demand.recipeYield);
  const expectedOutput = batchesNeeded * demand.recipeYield;
  
  // Scale ingredients by batches
  const requiredIngredients = recipe.ingredients.map(ing => {
    const inv = inventory.find(i => i.id === ing.inventoryId);
    return {
      name: ing.name,
      qtyPerBatch: ing.qtyPerBatch,
      totalQty: ing.qtyPerBatch * batchesNeeded,
      unit: ing.unit,
      inventoryId: ing.inventoryId,
    };
  });
  
  return {
    recipeName: demand.recipeName,
    totalDemand: demand.totalDemand,
    recipeYield: demand.recipeYield,
    batchesNeeded,
    expectedOutput,
    requiredIngredients,
  };
}
```

### Component 3: OutputAllocator
**Purpose:** Splits produced qty back to individual products, tracks buffer

**Props:**
- `batchCalc: BatchCalculation`
- `demands: RecipeDemand['demandedBy']`

**Output:**
- `OutputAllocation` — How to distribute produced qty

**Logic:**
```typescript
function allocateOutput(batch: BatchCalculation, demands: RecipeDemand['demandedBy']): OutputAllocation {
  let remaining = batch.expectedOutput;
  const allocations = [];
  
  // Sort by priority (could be by DOS priority or order)
  const sortedDemands = [...demands].sort((a, b) => a.qty - b.qty);
  
  for (const demand of sortedDemands) {
    const allocated = Math.min(demand.qty, remaining);
    allocations.push({
      productName: demand.productName,
      demandQty: demand.qty,
      allocatedQty: allocated,
      priority: allocations.length + 1,
    });
    remaining -= allocated;
  }
  
  return {
    recipeName: batch.recipeName,
    producedQty: batch.expectedOutput,
    allocations,
    bufferStock: remaining,  // Excess = buffer
  };
}
```

### Component 4: ProductionPlanPanel
**Purpose:** Main UI container showing the complete production plan

**Sub-components inside:**
1. **RecipeDemandTable** — Shows aggregated demands
2. **BatchCalculationView** — Shows batch requirements
3. **OutputAllocationView** — Shows how output will be split
4. **BufferStockPreview** — Shows expected buffer stock
5. **ConfirmPlanButton** — Saves plan and triggers inventory deductions

---

## 🗄️ Database Schema Changes

### New Table: `production_plans`
```sql
CREATE TABLE production_plans (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  dos_items JSONB NOT NULL,          -- Original DOS items
  recipe_demands JSONB NOT NULL,     -- Aggregated demands
  batch_calculations JSONB NOT NULL, -- Batch calculations
  output_allocations JSONB NOT NULL, -- Output splits
  buffer_stock_created JSONB DEFAULT '[]',
  buffer_stock_used JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);
```

### New Table: `buffer_stock`
```sql
CREATE TABLE buffer_stock (
  id TEXT PRIMARY KEY,
  recipe_name TEXT NOT NULL,
  product_name TEXT,
  qty NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'production-plan',
  batch_ref TEXT,
  date_created DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  used_in TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Modify Table: `recipes` (already has yield)
```sql
-- yield column already added via migration 00041
-- No additional changes needed
```

---

## 🔗 Integration Points

### With Pre-Mix (Current)
**Before:**
```
DOS → Product → Recipe → Deduct Ingredients
```

**After:**
```
Production Plan → Batch Calculation → Pre-Mix uses batch plan → Deduct scaled ingredients
```

**Change:** Pre-Mix now reads from `ProductionPlan.batchCalculations` instead of raw DOS items.

### With Advanced Premix (Current)
**Unchanged** — Still allows fine-tuning of compositions.

### With Deco Queue (Current)
**Unchanged** — Still decorates finished products.

### With Freezer (Enhanced)
**Add:** Buffer Stock tab in Freezer to track reusable excess.

### With Baker (New Integration)
**Buffer Stock → Baker:** If buffer stock exists for a recipe, it should be consumed before producing new batches.

---

## 📋 Implementation Steps

### Phase 1: Types & Core Logic (No UI)
1. Add new types to `types.ts`
2. Create utility functions:
   - `aggregateRecipeDemand()`
   - `calculateBatches()`
   - `allocateOutput()`
3. Add database migrations for `production_plans` and `buffer_stock` tables

### Phase 2: Production Plan Panel (UI)
4. Create `ProductionPlanPanel` component
5. Create `RecipeDemandTable` sub-component
6. Create `BatchCalculationView` sub-component
7. Create `OutputAllocationView` sub-component
8. Create `BufferStockPreview` sub-component
9. Add to Deco Dashboard navigation

### Phase 3: Integration
10. Modify Pre-Mix to use batch plan
11. Add Buffer Stock tab to Freezer
12. Add buffer stock consumption logic to batch calculator

### Phase 4: Workflow
13. Add "Confirm Plan" action that:
    - Saves production plan to database
    - Deducts ingredients from inventory
    - Creates buffer stock entries
    - Updates audit log

---

## 🧮 Example Calculation

### Input
```
DOS Items:
- Burger Bun: 15 pcs
- Hotdog Bun: 10 pcs

Recipe: Basic Bread Dough
- Yield: 27 pcs/batch
- Ingredients per batch:
  - Bread Flour: 10 kg
  - Sugar: 1.5 kg
  - Yeast: 0.5 kg
```

### Processing
```
Step 1: Group by Recipe
→ Basic Bread Dough: 15 + 10 = 25 pcs demand

Step 2: Apply Yield
→ 25 ÷ 27 = 0.92 → CEILING = 1 batch

Step 3: Calculate Output
→ Expected Output: 1 × 27 = 27 pcs

Step 4: Allocate Output
→ Burger Bun: 15 allocated (demand met)
→ Hotdog Bun: 10 allocated (demand met)
→ Buffer Stock: 2 pcs (excess)

Step 5: Scale Ingredients
→ Bread Flour: 10 × 1 = 10 kg needed
→ Sugar: 1.5 × 1 = 1.5 kg needed
→ Yeast: 0.5 × 1 = 0.5 kg needed
```

### Output
```typescript
{
  recipeName: "Basic Bread Dough",
  totalDemand: 25,
  recipeYield: 27,
  batchesNeeded: 1,
  expectedOutput: 27,
  allocations: [
    { productName: "Burger Bun", demandQty: 15, allocatedQty: 15 },
    { productName: "Hotdog Bun", demandQty: 10, allocatedQty: 10 },
  ],
  bufferStock: 2,
  requiredIngredients: [
    { name: "Bread Flour", totalQty: 10, unit: "kg" },
    { name: "Sugar", totalQty: 1.5, unit: "kg" },
    { name: "Yeast", totalQty: 0.5, unit: "kg" },
  ]
}
```

---

## 🔄 Buffer Stock Rules

### Rule 1: Buffer is NOT Waste
```
Produced: 27
Used for orders: 25
Buffer: 2 → Stored as reusable inventory
```

### Rule 2: Buffer Consumption
```
Next DOS for same recipe:
- Buffer available: 2
- New demand: 20
- Net demand: 20 - 2 = 18
- Batches needed: Math.ceil(18 / 27) = 1 batch
```

### Rule 3: Buffer Expiry
```
Buffer stock has configurable expiry (e.g., 3 days)
After expiry → Move to Waste tracking
```

---

## 📱 UI Mockup

### Production Plan Panel
```
┌─────────────────────────────────────────────────────┐
│  Production Plan — June 8, 2026                     │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  RECIPE DEMAND                              │    │
│  │  ┌──────────────────┬───────┬───────┬─────┐ │    │
│  │  │ Recipe           │ Yield │ Demand│ Batches│ │    │
│  │  ├──────────────────┼───────┼───────┼─────┤ │    │
│  │  │ Basic Bread      │  27   │  25   │  1  │ │    │
│  │  │ Chocolate Cake   │  50   │  40   │  1  │ │    │
│  │  └──────────────────┴───────┴───────┴─────┘ │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  OUTPUT ALLOCATION — Basic Bread Dough      │    │
│  │  Produced: 27 pcs                           │    │
│  │  ┌──────────────────┬───────┬───────────┐   │    │
│  │  │ Product          │Demand │ Allocated │   │    │
│  │  ├──────────────────┼───────┼───────────┤   │    │
│  │  │ Burger Bun       │  15   │    15     │   │    │
│  │  │ Hotdog Bun       │  10   │    10     │   │    │
│  │  ├──────────────────┼───────┼───────────┤   │    │
│  │  │ Buffer Stock     │   —   │     2     │   │    │
│  │  └──────────────────┴───────┴───────────┘   │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  INGREDIENTS REQUIRED                       │    │
│  │  Bread Flour: 10 kg                         │    │
│  │  Sugar: 1.5 kg                              │    │
│  │  Yeast: 0.5 kg                              │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│              [ Confirm Production Plan ]             │
└─────────────────────────────────────────────────────┘
```

---

## ✅ Success Criteria

1. **Recipe Aggregation** — Multiple DOS products sharing same recipe are grouped
2. **Yield-Based Batches** — Batches calculated using ceiling division
3. **Output Allocation** — Produced qty correctly split back to products
4. **Buffer Tracking** — Excess stored as reusable inventory, not waste
5. **Buffer Consumption** — Next day's plan considers existing buffer
6. **Ingredient Scaling** — Ingredients scaled by batch count
7. **Integration** — Works with existing Pre-Mix and Freezer flows

---

## ⚠️ Edge Cases to Handle

1. **No Recipe** — Product without recipe → Skip or warn
2. **No Yield** — Recipe without yield → Default to 1 or prompt user
3. **Zero Buffer** — Exact demand match → No buffer created
4. **Negative Buffer** — Demand > Output → Multiple batches needed
5. **Multiple Recipes** — Product with linked recipes → Aggregate both
6. **Partial Allocation** — If inventory insufficient → Warning
7. **Buffer Expiry** — Auto-expire old buffer stock

---

## 📁 Files to Create/Modify

### New Files
- `src/types/production-plan.ts` — New type definitions
- `src/utils/production-calculation.ts` — Core calculation logic
- `src/components/ProductionPlanPanel.tsx` — Main UI component
- `src/components/RecipeDemandTable.tsx` — Demand aggregation view
- `src/components/BatchCalculationView.tsx` — Batch calculation view
- `src/components/OutputAllocationView.tsx` — Output allocation view
- `src/components/BufferStockPreview.tsx` — Buffer stock preview
- `supabase/migrations/00042_production_plans.sql` — New table
- `supabase/migrations/00043_buffer_stock.sql` — New table

### Modified Files
- `src/types.ts` — Add new types
- `src/components/DecoDashboard.tsx` — Add Production Plan Panel tab
- `src/components/DecoDashboard.tsx` — Add Buffer Stock tab to Freezer
- `src/lib/db.ts` — Add CRUD for new tables
