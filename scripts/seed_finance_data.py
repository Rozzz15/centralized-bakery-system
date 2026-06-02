import re

filepath = "src/App.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Find the position right before the final closing bracket of seedIfEmpty
# We want to insert before the line "  // Product catalog" or the closing "}"
# Actually, let's find the end of seedIfEmpty function

# The seedIfEmpty function ends with:
#   if (catErr && !catErr.message.includes("duplicate")) console.error("seed catalog error:", catErr);
# }
# Then there's a blank line and "export default function App() {"

# Let's find where to insert: after the catalog seeding, before the closing }
pattern = r"(  // Product catalog\s+.*?(?:\n  \})?)\n\}"

# Actually, let me look at what's there:
#   // Product catalog
#   const products = ["Pandesal", "Loaf Bread", "Choco Moist Cake", "Sponge Fudge", "Ensaymada"];
#   const { error: catErr } = await supabase.from("product_catalog").insert(products.map(n => ({ name: n })));
#   if (catErr && !catErr.message.includes("duplicate")) console.error("seed catalog error:", catErr);
# }

# I'll insert finance seeding right before the closing }

seed_code = '''
  // Finance seed data
  const existingPurchases = await db.fetchPurchases();
  if (existingPurchases.length === 0) {
    const demoSupabaseId = crypto.randomUUID();
    const now = new Date().toISOString();
    const demoPurchases = [
      { id: `FIN-P-${Date.now()}-1`, supplierName: "Golden Mill", modeOfPayment: "check" as const, dateDelivered: "2026-05-25", particular: "Bread Flour 500kg", amount: 24000, dueDate: "2026-06-25", releasedDate: "2026-05-25", paymentStatus: "paid" as const, remarks: "Regular flour order" },
      { id: `FIN-P-${Date.now()}-2`, supplierName: "DairyCo", modeOfPayment: "cash" as const, dateDelivered: "2026-05-26", particular: "Fresh Milk 200L + Butter 50kg", amount: 38000, dueDate: "2026-06-10", releasedDate: "", paymentStatus: "unpaid" as const, remarks: "Weekly dairy supply" },
      { id: `FIN-P-${Date.now()}-3`, supplierName: "SweetSource", modeOfPayment: "online" as const, dateDelivered: "2026-05-24", particular: "Granulated Sugar 300kg", amount: 18600, dueDate: "2026-06-24", releasedDate: "2026-05-24", paymentStatus: "paid" as const, remarks: "" },
      { id: `FIN-P-${Date.now()}-4`, supplierName: "PackPro", modeOfPayment: "cash" as const, dateDelivered: "2026-05-27", particular: "Cake Boxes (8\") 1000pcs + Bread Bags 500pcs", amount: 12500, dueDate: "2026-06-11", releasedDate: "", paymentStatus: "unpaid" as const, remarks: "Packaging materials for June" },
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
    await Promise.all([
      db.upsertPurchases(demoPurchases),
      db.upsertBillsAndDues(demoBills),
      db.upsertRevenue(demoRevenue),
      db.upsertWasteLog(demoWaste),
    ]);
  }
'''

# Find the closing brace of seedIfEmpty (the first "}" after the catalog seeding)
# Let's find "export default function App()" and insert right before it
insert_marker = "export default function App()"
idx = content.rfind(insert_marker)
if idx == -1:
    print("ERROR: Could not find 'export default function App()'")
else:
    # Find the last "}" before this position (closing of seedIfEmpty)
    # Work backwards from idx to find the matching closing brace
    # seedIfEmpty ends with:
    #   if (catErr && !catErr.message.includes("duplicate")) console.error("seed catalog error:", catErr);
    # }
    # 
    # export default function App() {
    
    # Find the line before "export default function App()"
    pre_lines = content[:idx].rstrip()
    # The last "}" in this area is the closing of seedIfEmpty
    # Let's find it by looking for the last occurrence of a line with just "}"
    lines = pre_lines.split('\n')
    
    # Find the last closing brace that belongs to seedIfEmpty
    # We'll look for the pattern: line with just "}" followed by blank line(s) then "export default function App()"
    last_brace_idx = -1
    for i in range(len(lines) - 1, -1, -1):
        stripped = lines[i].strip()
        if stripped == '}':
            last_brace_idx = i
            break
    
    if last_brace_idx == -1:
        print("ERROR: Could not find closing brace of seedIfEmpty")
    else:
        # Insert the seed code before the closing brace
        insert_pos = sum(len(l) + 1 for l in lines[:last_brace_idx])
        new_content = content[:insert_pos] + seed_code + '\n' + content[insert_pos:]
        
        with open(filepath, "w", encoding="utf-8", newline="\n") as f:
            f.write(new_content)
        
        print(f"SUCCESS: Inserted finance seed data in App.tsx")
