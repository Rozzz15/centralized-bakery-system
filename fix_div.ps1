$path = "c:\Users\Admin\Desktop\Businesses\CENTRALIZED BAKERY SUPPLY, PRODUCTION & DISTRIBUTION SYSTEM\src\components\AdminDashboard.tsx"
$content = [System.IO.File]::ReadAllText($path)

# Pattern to find: the extra closing div between the grid section and the Unit Price Overrides comment
$pattern = "          </div>`r`n          </div>`r`n"
$replacement = "          </div>`r`n"

if ($content.Contains("          </div>`r`n          </div>`r`n           `r`n          {/* Unit Price Overrides */}")) {
    $content = $content.Replace("          </div>`r`n          </div>`r`n           `r`n          {/* Unit Price Overrides */}", "          </div>`r`n`r`n          {/* Unit Price Overrides */}")
    [System.IO.File]::WriteAllText($path, $content)
    Write-Host "Fixed! Removed extra closing div."
} else {
    Write-Host "Pattern not found - checking raw bytes..."
    # Try a different approach - find and count occurrences
    $idx = $content.IndexOf("Unit Price Overrides")
    Write-Host "Unit Price comment found at index: $idx"
    $before = $content.Substring([Math]::Max(0, $idx - 100), 100)
    Write-Host "Context before: [$before]"
}
