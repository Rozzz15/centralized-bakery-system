with open("src/components/DecoDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

old = """onAddAuditLog?.("PREP_SAVED_TO_FREEZER", `${product}: ${deductions.join(", ")}`);"""
new = """onAddAuditLog?.("PREP_SAVED_TO_FREEZER", `${product}: ${deductions.length > 0 ? deductions.join(", ") : "(no ingredients deducted)"}`);"""

count = content.count(old)
if count == 0:
    print("ERROR: Could not find audit log line")
    # Try to find partial
    if "PREP_SAVED_TO_FREEZER" in content:
        print("Found 'PREP_SAVED_TO_FREEZER' marker, but exact line may differ")
    exit(1)

content = content.replace(old, new, 1)
with open("src/components/DecoDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print(f"Fixed audit log: {count} replacement(s)")
