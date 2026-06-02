import re

with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add finance state hooks at the top level, after the renameValue line
# Find the existing stockroom section
insert_point = '  const [renameValue, setRenameValue] = useState("");\n\n  // Stockroom'

finance_hooks = '''  const [renameValue, setRenameValue] = useState("");

  // Finance
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [showAddBill, setShowAddBill] = useState(false);
  const [editingBill, setEditingBill] = useState<BillDue | null>(null);
  const [showAddRevenue, setShowAddRevenue] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [showAddWaste, setShowAddWaste] = useState(false);
  const [editingWaste, setEditingWaste] = useState<WasteLog | null>(null);
  const [financeSearch, setFinanceSearch] = useState("");
  const [financeTab, setFinanceTab] = useState<"purchases" | "bills" | "revenue" | "waste">("purchases");

  // Stockroom'''

content = content.replace(insert_point, finance_hooks, 1)

if content.find(insert_point) != -1:
    print('FAILED: Insert point still found - replacement might not have worked')
else:
    print('SUCCESS: Finance state hooks added at top level')

# 2. Remove the useState hooks from inside the finance conditional
# The hooks to remove are from line ~1473+ 
hooks_to_remove = '''    const [showAddPurchase, setShowAddPurchase] = useState(false);
    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
    const [showAddBill, setShowAddBill] = useState(false);
    const [editingBill, setEditingBill] = useState<BillDue | null>(null);
    const [showAddRevenue, setShowAddRevenue] = useState(false);
    const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
    const [showAddWaste, setShowAddWaste] = useState(false);
    const [editingWaste, setEditingWaste] = useState<WasteLog | null>(null);
    const [financeSearch, setFinanceSearch] = useState("");
    const [financeTab, setFinanceTab] = useState<"purchases" | "bills" | "revenue" | "waste">("purchases");

'''

# Try to find and remove the hooks
if hooks_to_remove in content:
    content = content.replace(hooks_to_remove, '', 1)
    print('SUCCESS: useState hooks removed from inside finance conditional')
else:
    print('FAILED: Could not find hooks inside conditional - checking CRLF...')
    hooks_to_remove_crlf = hooks_to_remove.replace('\n', '\r\n')
    if hooks_to_remove_crlf in content:
        content = content.replace(hooks_to_remove_crlf, '', 1)
        print('SUCCESS with CRLF')

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content := content)

total_lines = len(new_content.splitlines())
print(f'Total lines: {total_lines}')

# Verify: check that the conditional no longer has useState calls inside it
if 'if (activeTab === "finance") {' in new_content:
    # Find the finance conditional
    idx = new_content.find('if (activeTab === "finance") {')
    end_idx = new_content.find('/* ── Default: Admin Dashboard ── */')
    finance_section = new_content[idx:end_idx]
    if 'useState(' in finance_section:
        print('WARNING: useState still found inside finance conditional!')
    else:
        print('OK: No useState hooks inside finance conditional')

# Verify top-level hooks exist
if 'const [showAddPurchase, setShowAddPurchase] = useState(false);' in new_content:
    print('OK: Top-level showAddPurchase hook found')
else:
    print('WARNING: showAddPurchase not found at top level!')
