import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/components/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# Remove unused unpaidPurchasesAmt
old1 = '          const unpaidPurchasesAmt = purchaseData.filter(p => p.paymentStatus === "unpaid" || p.paymentStatus === "overdue").reduce((s, p) => s + p.amount, 0);\n'
if old1 in content:
    content = content.replace(old1, '', 1)
    changes += 1
    print("OK - Removed unused unpaidPurchasesAmt")
else:
    print("WARNING: unpaidPurchasesAmt not found")

# Remove unused pendingBillsAmt
old2 = '          const pendingBillsAmt = billData.filter(b => b.status === "pending" || b.status === "overdue").reduce((s, b) => s + b.amount, 0);\n'
if old2 in content:
    content = content.replace(old2, '', 1)
    changes += 1
    print("OK - Removed unused pendingBillsAmt")
else:
    print("WARNING: pendingBillsAmt not found")

with open('src/components/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

if changes > 0:
    print(f"\n{changes} fix(es) applied")
else:
    print("\nNo changes made")

print("Done")
