# Deco Account — Components, Roles, Functionalities & Priorities

## Role Overview

The **Deco (Decoration) Account** is responsible for the visual finishing and presentation of bakery products. The decorator receives Daily Order Sales (DOS) items assigned by Admin, prepares ingredient pre-mixes, curates advanced premix compositions, decorates products (cakes, pastries), manages decoration queues, tracks custom orders, and handles finished goods in the freezer.

**Assigned Role ID:** `deco`

---

## Dashboard Tabs & Components

### 1. Dashboard (DOS Received)

**Purpose:** Landing page showing today's DOS items assigned to the Deco role with a recipe-based overview.

| Component | Description |
|---|---|
| **DOS Total Card** | Displays total qty and item count of today's DOS items assigned to deco |
| **Products to Mix Card** | Count of DOS products with linked recipes; clickable to open summary modal |
| **Recipe Needed Card** | Count of sub-recipes linked to DOS items that need preparation |
| **Packaging Materials Card** | Count of unique packaging materials required across all DOS recipes |
| **Deco Supplies Card** | Count of unique decoration supplies required across all DOS recipes |
| **Recipe Formula Table** | List of linked recipes with total qty and ingredient count; clickable for detail modal |
| **Summary Modals (4 types)** | Products, Recipe Needed, Packaging Materials, Deco Supplies — each shows itemized breakdown |
| **DOS Recipe Detail Modal** | Read-only view of a recipe's ingredients, packaging, and decoration supplies scaled by qty |
| **Workflow Nav** | Step indicator (1 of 4) + "Next: Pre-Mix →" button |

**Data Sources:** `dosItems` (filtered by role=deco + assigned production tasks), `recipes`, `inventory`

---

### 1a. Pre-Mix (Production Preparation) Sub-View

**Purpose:** Prepare ingredient pre-mixes for each DOS product before decoration. Accessed from Dashboard via "Next: Pre-Mix →".

| Component | Description |
|---|---|
| **Product Header** | Each DOS product with checkbox selection, qty stepper (−/+), recipe count |
| **Recipe Cards (grid)** | Per-product linked recipe cards showing ingredient/packaging/deco counts; tap to open detail |
| **Recipe Detail Modal** | Full recipe view with ingredients list, qty multiplier, linked packaging & decoration supplies |
| **Prepared Toggle** | Per-recipe "Done" badge tracking preparation state |
| **Freezer Action Bar** | Fixed bottom bar when recipes selected: "Put in Production Recipe" or "Put in My Inventory" buttons |
| **Qty Stepper** | Per-product quantity adjuster (min 1, max DOS qty) with save-amounts tracking |
| **Workflow Nav** | Step 2 of 4 + "Next: Advanced Premix →" button |

**Key Actions:**
- **Put in Production Recipe** — Deducts ingredients from inventory, creates freezer items with `notes: "Production Recipe"`
- **Put in My Inventory** — Creates/updates inventory items with `source: "production-prep"` and `accessRoles: ["deco"]`, deducts ingredients

**Supabase Tables:** `deco_production_prep` (prepared/done/qty state), `inventory`, `freezer_items`

---

### 2. Advanced Premix

**Purpose:** Curate recipe batches with fine-tuned ingredient compositions and save them to the freezer for Baker's Assembly.

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

**Supabase Tables:** `freezer_items` (batch ref `ADV-*`), `pastry_assembly_tasks`

---

### 3. Decoration Queue

**Purpose:** Manage the decoration workflow — pick products from My Inventory (Production Prep), design them with themes, and track through completion.

| Component | Description |
|---|---|
| **Available from My Inventory** | Paginated grid of `production-prep` sourced inventory items with "Design →" button |
| **Search (Production Prep)** | Filters prep inventory by name/SKU |
| **Design Modal** | Form: qty to design, linked packaging/decoration preview, theme input, notes textarea |
| **Active Decoration Queue** | Cards for pending/in-progress tasks with status badges and action buttons |
| **Decoration History** | Expandable compact cards for completed tasks with date, qty, theme details |
| **Task Status Flow** | `pending` → `in-progress` (Start Decorating) → `completed` (Put it on Display Cake) |

**Key Actions:**
- **Design** — Deducts designed qty from source inventory item; creates `DecoTask` with snapshot
- **Start Decorating** (pending → in-progress) — Deducts packaging materials + decoration supplies from inventory
- **Put it on Display Cake** (in-progress → completed) — Adds finished product to Freezer Display Cakes
- **Delete** — Restores source inventory (via snapshot or partial refund)

**Supabase Tables:** `decoration_queue`, `inventory` (deductions), `freezer_items` (completed items)

---

### 4. Custom Orders

**Purpose:** Manage customer-requested customizations and special cake designs.

| Component | Description |
|---|---|
| **Order Cards** | Customer name, product, request details, status badge |
| **Status Flow** | `pending` → `in-progress` (Start) → `completed` (Complete) |
| **Request Display** | Dedicated section showing the customer's customization request |

**Note:** Currently uses local state (mock data). Not yet synced to Supabase.

---

### 5. Decoration Materials

**Purpose:** View-only display of decoration supply stock levels.

| Component | Description |
|---|---|
| **Materials Table** | Name, SKU, On Hand (color-coded), Threshold, Unit |
| **Low Stock Indicators** | Red = 0 on hand, Amber = below threshold, Green = sufficient |

**Access:** Read-only. Contact Admin to replenish.

---

### 6. Ingredients

**Purpose:** View-only display of ingredient stock from the Warehouse.

| Component | Description |
|---|---|
| **Ingredients Table** | Name, SKU, On Hand (color-coded), Threshold, Unit |
| **Low Stock Indicators** | Same color coding as Decoration Materials |

**Access:** Read-only. For reference during pre-mix preparation.

---

### 7. Freezer — Finished Products

**Purpose:** Track all decorated and prepared products ready for dispatch or further processing.

#### Sub-Tabs:

| Tab | Content | Source |
|---|---|---|
| **Display Cakes** | Finished decorated cakes from Decoration Queue | `decoQueue` completed tasks → freezer |
| **Production Recipe** | Pre-mixed items saved from Pre-Mix step | Pre-Mix "Put in Production Recipe" action |
| **Advanced Premix** | Curated compositions from Advanced Premix step | Advanced Premix save action (batch ref `ADV-*`) |
| **My Inventory** | Deco's own inventory (production-prep + manual items) | Pre-Mix "Put in My Inventory" + Admin-assigned items |

| Component | Description |
|---|---|
| **Tab Navigation** | 4 sub-tabs with count/total stats per tab |
| **Search Bar** | Filters products by name |
| **Stats Cards** | Item count + total qty/stock per active tab |
| **Add Product Modal** | Form: product (from catalog), qty, unit, batch ref, notes |
| **Edit Product Modal** | Edit existing freezer item details |
| **Delete** | Removes item from freezer (with confirmation) |

**Supabase Tables:** `freezer_items`, `inventory` (for My Inventory tab)

---

### 8. Waste & Adjustment

**Purpose:** Record wasted, damaged, or adjusted stock from inventory and freezer.

| Component | Description |
|---|---|
| **Source Type Selector** | 3 options: Freezer Display Cakes, Freezer Production Recipe, My Inventory |
| **Item Search/Select** | Dropdown search to pick the item to waste |
| **Qty Stepper** | Quantity to deduct (with max validation) |
| **Reason Dropdown** | Spoilage, Damaged/Breakage, Expired, Overproduction, Quality Issue, Wrong Product, Contamination, Other |
| **Record Button** | Deducts from source + saves waste log entry |
| **Waste History Table** | Date, Product, Qty, Source, Reason, Delete action |

**Supabase Tables:** `waste_log` (shared with Admin Finance), `inventory`, `freezer_items`

---

## Workflow Steps (Ordered)

| Step | Tab | Description |
|---|---|---|
| 1 | Dashboard (DOS Received) | View today's assigned DOS items and recipe overview |
| 2 | Pre-Mix (sub-view) | Prepare ingredient pre-mixes, save to Production Recipe or My Inventory |
| 3 | Advanced Premix | Curate fine-tuned recipe compositions, save to freezer for Baker |
| 4 | Decoration Queue | Design, decorate, and complete products → Freezer Display Cakes |
| — | Freezer | Track all finished/decorated products |
| — | Waste & Adjustment | Record stock losses at any point |

---

## Priorities

### High Priority (Core Workflow)
1. **DOS Received** — Central entry point; must show accurate daily assignments
2. **Pre-Mix / Production Preparation** — Critical for ingredient deduction accuracy and freezer sync
3. **Decoration Queue** — Main job function; status flow must be reliable with proper inventory deductions
4. **Freezer (Display Cakes + Production Recipe)** — Inventory accuracy depends on correct freezer tracking

### Medium Priority (Supporting Functions)
5. **Advanced Premix** — Enables Baker Assembly workflow; composition adjustments must be precise
6. **Waste & Adjustment** — Financial tracking depends on accurate waste logging
7. **My Inventory** — Deco's working stock; must sync with Pre-Mix and Design actions

### Low Priority (Reference / Future)
8. **Decoration Materials** — Read-only view; useful but not blocking
9. **Ingredients** — Read-only reference; helpful for planning
10. **Custom Orders** — Currently mock data; needs Supabase integration

---

## Key Data Types Used

| Type | Purpose |
|---|---|
| `DOSItem` | Daily Order Sales items assigned to deco |
| `ProductionTask` | Production tasks assigned to `deco` role |
| `ProductRecipe` | Recipe with ingredients, packaging, decoration supplies |
| `InventoryItem` | Inventory items (decoration-supplies, packaging-materials, ingredients) |
| `FreezerItem` | Products stored in freezer (Display Cakes, Production Recipe, Advanced Premix) |
| `DecoTask` | Decoration queue task with theme, status, source snapshot |
| `CustomOrder` | Customer customization requests |
| `WasteLog` | Waste/adjustment records (shared with Admin Finance) |
| `DecoProductionPrep` | Per-DOS preparation state (prepared/done/qty) |

---

## Supabase Tables Accessed

| Table | Operations |
|---|---|
| `decoration_queue` | CRUD for decoration tasks |
| `deco_production_prep` | Read/Write preparation state |
| `freezer_items` | CRUD for all freezer products |
| `inventory` | Read/Update for ingredient deductions and My Inventory |
| `recipes` | Read for recipe data |
| `waste_log` | Create/Read waste records |
| `pastry_assembly_tasks` | Create tasks for Baker from Advanced Premix |

---

## Integration Points

| With Role | Integration |
|---|---|
| **Admin** | Receives DOS assignments; decoration supplies deducted from Admin-managed inventory |
| **Baker** | Advanced Premix saves create `PastryAssemblyTask` for Baker's Assembly |
| **Kitchen** | Indirect — Kitchen produces items that may flow to Deco for decoration |
| **Branch** | Finished Display Cakes in freezer are available for Branch dispatch |
