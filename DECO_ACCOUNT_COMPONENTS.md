# Deco Account — Components, Roles, Functionalities & Priorities

## Role Overview

The **Deco (Decoration) Account** is responsible for the visual finishing and presentation of bakery products. The decorator receives Daily Order Sales (DOS) items assigned by Admin, prepares ingredient pre-mixes, curates advanced premix compositions, decorates products (cakes, pastries), manages decoration queues, tracks custom orders, and handles finished goods in the freezer.

**Assigned Role ID:** `deco`

---

## Workflow (5-Step Process)

The Deco Account follows a linear 5-step workflow. Each step produces outputs that feed into the next. The sidebar provides access to reference tabs and supporting functions at any time.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   1. DOS Received ──► 2. Production Plan ──► 3. Advanced Premix    │
│         (Dashboard)        (Batch Planning)      (Composition)     │
│                                                                     │
│   4. Decoration Queue ──► 5. Finished Products (Freezer)           │
│         (Design & Decorate)    (Track & Store)                      │
│                                                                     │
│   Sidebar: Custom Orders │ Waste/Adjustment │ Ingredients │ Deco   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Dashboard (DOS Received)

**Tab ID:** `dashboard`
**Workflow Position:** Step 1 of 5
**Purpose:** Landing page showing today's DOS items assigned to the Deco role with a recipe-based overview.

### Components

| Component | Description |
|---|---|
| **DOS Total Card** | Displays total qty and item count of today's DOS items assigned to deco |
| **Products to Mix Card** | Count of DOS products with linked recipes; clickable to open summary modal |
| **Recipe Needed Card** | Count of sub-recipes linked to DOS items that need preparation |
| **Packaging Materials Card** | Count of unique packaging materials required across all DOS recipes |
| **Deco Supplies Card** | Count of unique decoration supplies required across all DOS recipes |
| **Recipe Formula Table** | List of linked recipes with total qty and ingredient count; clickable for detail modal |
| **Summary Modals (4 types)** | Products, Recipe Needed, Packaging Materials, Deco Supplies — each shows itemized breakdown |
| **DOS Recipe Detail Modal** | Read-only view of a recipe's ingredients, packaging, and decoration supplies scaled by qty; includes yield editor |
| **Workflow Nav** | Step indicator (1 of 5) + "Next: Production Plan →" button |

### Data Sources
- `dosItems` (filtered by role=deco + today's date)
- `recipes` (for recipe lookup and ingredient scaling)
- `inventory` (for packaging/deco supply counts)

### Key Behavior
- Filters DOS items by `roles.includes("deco")` and today's date
- Marks new DOS items as seen via `onMarkDOSSeen`
- Links to recipe detail modal with yield editor per recipe

---

## Step 2: Production Plan

**Tab ID:** `production-plan`
**Workflow Position:** Step 2 of 5
**Purpose:** Recipe-level batch planning with yield calculation, buffer stock tracking, and ingredient/packaging/deco supply aggregation.

### Components

| Component | Description |
|---|---|
| **Summary Cards (4)** | Total Demand, Expected Output, Buffer Stock (excess), Buffer Available (from previous plans) |
| **Recipe Demand Aggregation Table** | Recipe name, yield, total demand, buffer deduction, net demand, batches needed, expected output; shows which products demand each recipe |
| **Output Allocation** | Per-recipe breakdown showing how produced output is allocated back to requesting products; excess becomes buffer stock |
| **Ingredients Required** | Aggregated ingredient totals across all batches, color-coded amber panel |
| **Packaging Required** | Aggregated packaging totals across all batches, color-coded blue panel |
| **Deco Supplies Required** | Aggregated decoration supply totals across all batches, color-coded purple panel |
| **Confirm Button** | Saves the production plan to Supabase, creates buffer stock entries, logs audit event, then advances to Advanced Premix |

### Calculation Engine (`src/utils/production-calculation.ts`)

| Function | Purpose |
|---|---|
| `aggregateRecipeDemand()` | Groups DOS items by recipe (direct + linked), sums demand per recipe, merges duplicate product entries in `demandedBy` |
| `calculateBatches()` | Computes batches needed: `ceil(netDemand / yield)`, scales ingredients/packaging/deco by batch count |
| `allocateOutput()` | Distributes produced output back to requesting products (smallest demand first); excess becomes buffer stock |
| `createBufferStockEntries()` | Creates buffer stock records from allocation excess |
| `getAvailableBuffer()` | Sums available buffer stock for a recipe |
| `sumIngredients()` / `sumPackaging()` / `sumDecoSupplies()` | Aggregates resource totals across all batch calculations |

### Data Flow
```
DOS Items (filtered for deco, today)
    ↓
aggregateRecipeDemand(dosItems, recipes)
    ↓
calculateBatches(demand, recipe, inventory, bufferStock)  [per recipe]
    ↓
allocateOutput(batch, demands)  [per recipe]
    ↓
createBufferStockEntries(allocation)  [per recipe with excess]
    ↓
planDraft = { demands, batches, allocations, bufferCreated }
```

### Data Sources
- `dosItems` (filtered by role=deco + today's date, excluding "scheduled" status)
- `recipes` (for yield, ingredients, packaging, deco supplies)
- `inventory` (for current stock levels)
- `planBufferStock` (existing buffer stock entries from previous plans)

### Key Behavior
- Draft is auto-computed via `useEffect` when `dosItems`, `recipes`, `inventory`, or `planBufferStock` change
- Confirming saves to `production_plans` table and `buffer_stock` table
- Advances to Advanced Premix after confirmation

---

## Step 3: Advanced Premix

**Tab ID:** `advanced-premix`
**Workflow Position:** Step 3 of 5
**Purpose:** Curate recipe batches with fine-tuned ingredient compositions and save them to the freezer for Baker's Assembly.

### Components

| Component | Description |
|---|---|
| **Search Bar** | Filters recipes by name |
| **Recipe Selection Grid** | Toggle-able recipe cards showing ingredient preview; select to include in premix |
| **Qty Input (per recipe)** | Batch multiplier (min 1) for each selected recipe |
| **Lock/Unlock Button** | Locks selection and opens the Composition Adjustment panel |
| **Composition Adjustment Panel** | Editable ingredient quantities per recipe with real-time total calculation |
| **Save to Freezer Button** | Saves adjusted compositions as freezer items with batch ref `ADV-{timestamp}` |
| **Confirmation Modal** | Shows summary of items + adjustments before saving |
| **Baker Assembly Task Creation** | Auto-creates `PastryAssemblyTask` records for Baker upon save |

### Data Sources
- `recipes` (for recipe data and ingredient compositions)
- `freezerItems` (for saving compositions)
- `inventory` (for ingredient stock reference)

### Key Actions
- **Select Recipes** — Toggle recipes to include in the premix batch
- **Adjust Composition** — Edit ingredient quantities per recipe
- **Save to Freezer** — Creates freezer items with `batchRef: "ADV-{timestamp}"` and `producedBy: "deco"`
- **Create Baker Task** — Auto-generates `PastryAssemblyTask` for Baker's Assembly workflow

---

## Step 4: Decoration Queue

**Tab ID:** `deco-queue`
**Workflow Position:** Step 4 of 5
**Purpose:** Manage the decoration workflow — pick products from My Inventory (Production Prep), design them with themes, and track through completion.

### Components

| Component | Description |
|---|---|
| **Available from My Inventory** | Paginated grid of `production-prep` sourced inventory items with "Design →" button |
| **Search (Production Prep)** | Filters prep inventory by name/SKU |
| **Design Modal** | Form: qty to design, linked packaging/decoration preview, theme input, notes textarea |
| **Active Decoration Queue** | Cards for pending/in-progress tasks with status badges and action buttons |
| **Decoration History** | Expandable compact cards for completed tasks with date, qty, theme details |
| **Task Status Flow** | `pending` → `in-progress` (Start Decorating) → `completed` (Put it on Display Cake) |

### Status Flow
```
pending ──► in-progress ──► completed
             │                  │
             │                  └──► Adds to Freezer (Display Cakes)
             │
             └──► Deducts packaging + deco supplies from inventory
```

### Key Actions
- **Design** — Deducts designed qty from source inventory item; creates `DecoTask` with snapshot
- **Start Decorating** (pending → in-progress) — Deducts packaging materials + decoration supplies from inventory
- **Put it on Display Cake** (in-progress → completed) — Adds finished product to Freezer Display Cakes
- **Delete** — Restores source inventory (via snapshot or partial refund)

### Data Sources
- `inventory` (for production-prep sourced items, packaging/deco deductions)
- `recipes` (for linked packaging/deco supplies)
- `freezerItems` (for completed display cakes)

---

## Step 5: Finished Products (Freezer)

**Tab ID:** `freezer`
**Workflow Position:** Step 5 of 5
**Purpose:** Track all decorated and prepared products ready for dispatch or further processing.

### Sub-Tabs

| Tab | Content | Source |
|---|---|---|
| **Display Cakes** | Finished decorated cakes from Decoration Queue | `decoQueue` completed tasks → freezer |
| **Production Recipe** | Pre-mixed items saved from Pre-Mix step | Pre-Mix "Put in Production Recipe" action |
| **Advanced Premix** | Curated compositions from Advanced Premix step | Advanced Premix save action (batch ref `ADV-*`) |
| **My Inventory** | Deco's own inventory (production-prep + manual items) | Pre-Mix "Put in My Inventory" + Admin-assigned items |
| **Buffer Stock** | Excess production output available for reuse | Production Plan buffer stock entries |

### Components

| Component | Description |
|---|---|
| **Tab Navigation** | 5 sub-tabs with count/total stats per tab |
| **Search Bar** | Filters products by name |
| **Stats Cards** | Item count + total qty/stock per active tab |
| **Add Product Modal** | Form: product (from catalog), qty, unit, batch ref, notes |
| **Edit Product Modal** | Edit existing freezer item details |
| **Delete** | Removes item from freezer (with confirmation) |

### Key Behavior
- My Inventory tab shows items grouped by source: "From Production Prep" section and "Manual" section
- Buffer Stock tab shows available buffer entries from Production Plan with qty and date

---

## Sidebar Tabs (Reference & Supporting)

These tabs are accessible at any time from the sidebar navigation.

### Custom Orders

**Tab ID:** `custom-orders`
**Purpose:** Manage customer-requested customizations and special cake designs.

| Component | Description |
|---|---|
| **Order Cards** | Customer name, product, request details, status badge |
| **Status Flow** | `pending` → `in-progress` (Start) → `completed` (Complete) |
| **Request Display** | Dedicated section showing the customer's customization request |

**Note:** Currently uses local state (mock data). Not yet synced to Supabase.

---

### Waste & Adjustment

**Tab ID:** `waste-adjustment`
**Purpose:** Record wasted, damaged, or adjusted stock from inventory and freezer.

| Component | Description |
|---|---|
| **Source Type Selector** | 3 options: Freezer Display Cakes, Freezer Production Recipe, My Inventory |
| **Item Search/Select** | Dropdown search to pick the item to waste |
| **Qty Stepper** | Quantity to deduct (with max validation) |
| **Reason Dropdown** | Spoilage, Damaged/Breakage, Expired, Overproduction, Quality Issue, Wrong Product, Contamination, Other |
| **Record Button** | Deducts from source + saves waste log entry with cost calculation |
| **Waste History Table** | Date, Product, Qty, Source, Reason, Cost, Delete action |

### Ingredients

**Tab ID:** `ingredients`
**Purpose:** View-only display of ingredient stock from the Warehouse.

| Component | Description |
|---|---|
| **Ingredients Table** | Name, SKU, On Hand (color-coded), Threshold, Unit |
| **Low Stock Indicators** | Red = 0 on hand, Amber = below threshold, Green = sufficient |

**Access:** Read-only. For reference during pre-mix preparation.

---

### Decoration Materials

**Tab ID:** `decoration-supplies`
**Purpose:** View-only display of decoration supply stock levels.

| Component | Description |
|---|---|
| **Materials Table** | Name, SKU, On Hand (color-coded), Threshold, Unit |
| **Low Stock Indicators** | Same color coding as Ingredients |

**Access:** Read-only. Contact Admin to replenish.

---

## Workflow Data Flow

```
Admin assigns DOS items (roles: ["deco"])
        │
        ▼
┌─── Step 1: Dashboard ──────────────────────────────────┐
│  • Filter today's DOS items for deco role              │
│  • Display recipe overview, packaging, deco supplies   │
│  • Recipe detail modals with yield editor              │
└───────────────────────────────┬────────────────────────┘
                                │ "Next: Production Plan →"
                                ▼
┌─── Step 2: Production Plan ────────────────────────────┐
│  • aggregateRecipeDemand() — group DOS by recipe       │
│  • calculateBatches() — compute batches with yield     │
│  • allocateOutput() — distribute output, create buffer │
│  • Confirm → save plan + buffer stock to Supabase     │
└───────────────────────────────┬────────────────────────┘
                                │ "Confirm Production Plan →"
                                ▼
┌─── Step 3: Advanced Premix ────────────────────────────┐
│  • Select recipes + set batch quantities               │
│  • Adjust ingredient compositions                      │
│  • Save to freezer (batch ref ADV-*)                   │
│  • Auto-create PastryAssemblyTask for Baker            │
└───────────────────────────────┬────────────────────────┘
                                │ "Next: Decoration Queue →"
                                ▼
┌─── Step 4: Decoration Queue ───────────────────────────┐
│  • Pick products from My Inventory (production-prep)   │
│  • Design: set theme, qty, preview packaging/deco      │
│  • Start Decorating: deduct packaging + deco supplies  │
│  • Put on Display Cake: move to Freezer Display Cakes  │
└───────────────────────────────┬────────────────────────┘
                                │ "Next: Finished Products →"
                                ▼
┌─── Step 5: Finished Products (Freezer) ────────────────┐
│  • Display Cakes — completed decorated products        │
│  • Production Recipe — pre-mixed production items      │
│  • Advanced Premix — curated compositions (ADV-*)      │
│  • My Inventory — deco's working stock                 │
│  • Buffer Stock — excess from production plans         │
└────────────────────────────────────────────────────────┘
```

---

## Supabase Tables Accessed

| Table | Operations | Used In |
|---|---|---|
| `decoration_queue` | CRUD | Decoration Queue |
| `deco_production_prep` | Read/Write | Pre-Mix |
| `freezer_items` | CRUD | Freezer, Advanced Premix, Decoration Queue |
| `inventory` | Read/Update | All steps (ingredient/deco deductions) |
| `recipes` | Read | All steps (recipe data) |
| `waste_log` | Create/Read | Waste & Adjustment |
| `pastry_assembly_tasks` | Create | Advanced Premix → Baker |
| `production_plans` | Create/Read | Production Plan |
| `buffer_stock` | Create/Read | Production Plan, Freezer |

---

## Key Data Types Used

| Type | Purpose |
|---|---|
| `DOSItem` | Daily Order Sales items assigned to deco |
| `ProductionTask` | Production tasks assigned to `deco` role |
| `ProductRecipe` | Recipe with ingredients, packaging, decoration supplies, yield, linked ingredients |
| `InventoryItem` | Inventory items (decoration-supplies, packaging-materials, ingredients) |
| `FreezerItem` | Products stored in freezer (Display Cakes, Production Recipe, Advanced Premix) |
| `DecoTask` | Decoration queue task with theme, status, source snapshot |
| `CustomOrder` | Customer customization requests (mock data) |
| `WasteLog` | Waste/adjustment records (shared with Admin Finance) |
| `DecoProductionPrep` | Per-DOS preparation state (prepared/done/qty) |
| `RecipeDemand` | Aggregated demand per recipe with `demandedBy` entries |
| `BatchCalculation` | Batch computation: yield, net demand, required resources |
| `OutputAllocation` | Output distribution back to products + buffer stock |
| `BufferStockEntry` | Reusable buffer stock from production excess |
| `ProductionPlan` | Full plan record with demands, batches, allocations, buffer |

---

## Integration Points

| With Role | Integration |
|---|---|
| **Admin** | Receives DOS assignments; decoration supplies deducted from Admin-managed inventory |
| **Baker** | Advanced Premix saves create `PastryAssemblyTask` for Baker's Assembly |
| **Kitchen** | Indirect — Kitchen produces items that may flow to Deco for decoration |
| **Branch** | Finished Display Cakes in freezer are available for Branch dispatch |

---

## Priorities

### High Priority (Core Workflow)
1. **DOS Received** — Central entry point; must show accurate daily assignments
2. **Production Plan** — Batch planning engine; drives resource requirements for all downstream steps
3. **Advanced Premix** — Enables Baker Assembly workflow; composition adjustments must be precise
4. **Decoration Queue** — Main job function; status flow must be reliable with proper inventory deductions
5. **Freezer (Display Cakes + Production Recipe)** — Inventory accuracy depends on correct freezer tracking

### Medium Priority (Supporting Functions)
6. **Waste & Adjustment** — Financial tracking depends on accurate waste logging
7. **My Inventory** — Deco's working stock; must sync with Pre-Mix and Design actions

### Low Priority (Reference / Future)
8. **Decoration Materials** — Read-only view; useful but not blocking
9. **Ingredients** — Read-only reference; helpful for planning
10. **Custom Orders** — Currently mock data; needs Supabase integration
