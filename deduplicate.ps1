# PowerShell script to deduplicate address data
$InputFile = "\\?\vsls:\data.csv"
$OutputFile = "\\?\vsls:\streets_final.txt"

$seen = @{}
$count = 0

Write-Host "Starting deduplication..." -ForegroundColor Green

$lineNum = 0
Get-Content $InputFile | ForEach-Object {
    $lineNum++
    
    try {
        $json = $_ | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($null -eq $json) { return }
        
        $street = $json.properties.street.Trim()
        $number = $json.properties.number.Trim()
        
        if ([string]::IsNullOrEmpty($street)) { return }
        
        # Build address
        if (-not [string]::IsNullOrEmpty($number)) {
            $address = "$number $street"
        } else {
            $address = $street
        }
        
        $normalized = $address.ToUpper()
        
        # Skip duplicates
        if ($seen.ContainsKey($normalized)) { return }
        
        $seen[$normalized] = $true
        Add-Content $OutputFile $address
        $count++
        
        if ($lineNum % 5000 -eq 0) {
            Write-Host "Processed $lineNum lines... ($count unique addresses)" -ForegroundColor Cyan
        }
    } catch {
        # Skip malformed lines
    }
}

Write-Host "`n✓ COMPLETE! Found $count unique streets/addresses" -ForegroundColor Green
Write-Host "Output saved to $OutputFile" -ForegroundColor Green
