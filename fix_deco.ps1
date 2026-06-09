$path = "src/components/DecoDashboard.tsx"
$content = [System.IO.File]::ReadAllText((Resolve-Path $path))

# Find the broken section boundaries
$startMarker = "                // Add to Baker Freezer (Deco Production Recipe tab)"
$endMarker = "                if (onCompleteTask) {"

$startIdx = $content.IndexOf($startMarker)
$endIdx = $content.IndexOf($endMarker, $startIdx + $startMarker.Length)

if ($startIdx -lt 0 -or $endIdx -lt 0) {
    Write-Host "ERROR: Could not find markers" -ForegroundColor Red
    exit 1
}

$brokenSection = $content.Substring($startIdx, $endIdx - $startIdx)
Write-Host "Found broken section at index $startIdx, length $($endIdx - $startIdx)" -ForegroundColor Green

# Build the fixed section
$fixedSection = @"
                // Add to Baker Freezer (Deco Production Recipe tab)
                if (route === "baker" && actualOutput > 0) {
                  const freezerItem: FreezerItem = {
                    id: `FRZ-$`{Date.now()}`,
                    productName: recipe.productName,
                    qty: actualOutput,
                    unit: "pcs",
                    batchRef: `DEC-$`{Date.now()}`,
                    producedBy: "deco",
                    dateProduced: new Date().toLocaleString("en-CA", { timeZone: "Asia/Manila" }).split(",")[0],
                    status: "stored",
                    notes: "Production Recipe",
                  };
                  // Save to freezer via state + DB
                  onUpdateFreezer?.(prev => [...prev, freezerItem]);
                  db.upsertFreezerItems([freezerItem]).catch(console.error);
                }
                // For deco route: add to My Inventory (as InventoryItem with source: production-prep)
                if (route === "deco" && actualOutput > 0) {
                  const existingItem = inventory.find(i => i.name === recipe.productName && i.accessRoles?.includes("deco"));
                  const decoUpdatedInventory = [...inventory];
                  if (existingItem) {
                    const updatedItem = { ...existingItem, onHand: existingItem.onHand + actualOutput, source: "production-prep" as const };
                    const idx = decoUpdatedInventory.findIndex(i => i.id === existingItem.id);
                    if (idx >= 0) decoUpdatedInventory[idx] = updatedItem;
                    db.upsertInventory([updatedItem]).catch(console.error);
                  } else {
                    const newItem: InventoryItem = {
                      id: `INV-$`{Date.now()}-$`{Math.random().toString(36).slice(2, 6)}`,
                      name: recipe.productName,
                      sku: `DECO-$`{recipe.productName.substring(0, 8).toUpperCase()}-$`{Date.now()}`,
                      unit: "pcs",
                      onHand: actualOutput,
                      threshold: 0,
                      cost: 0,
                      supplier: "",
                      lastIn: new Date().toISOString(),
                      category: "dry" as const,
                      group: "ingredients" as const,
                      accessRoles: ["deco"] as Role[],
                      source: "production-prep" as const,
                    };
                    decoUpdatedInventory.push(newItem);
                    db.upsertInventory([newItem]).catch(console.error);
                  }
                  onUpdateInventory(decoUpdatedInventory);
                }
"@

# Convert the here-string to have proper CRLF line endings
$fixedSection = $fixedSection -replace "`r?`n", "`r`n"

# Check that the broken section starts and ends with the expected text
if (-not $brokenSection.StartsWith($startMarker)) {
    Write-Host "ERROR: Broken section doesn't start with expected marker" -ForegroundColor Red
    exit 1
}

# Take the newline after endMarker as well
$endOfEndMarker = $endIdx + $endMarker.Length
# Check if there's a blank line after endMarker
$newContent = $content.Substring(0, $startIdx) + $fixedSection + $content.Substring($endIdx)

# Write back
[System.IO.File]::WriteAllText((Resolve-Path $path), $newContent, [System.Text.UTF8Encoding]::new($false))
Write-Host "Fix applied successfully!" -ForegroundColor Green
Write-Host "Replaced $($brokenSection.Length) chars with $($fixedSection.Length) chars" -ForegroundColor Green
