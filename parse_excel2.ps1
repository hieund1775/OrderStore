Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = "$env:TEMP\test_order2.zip"
Copy-Item "Test Order2.xlsx" $zipPath -Force
$extractDir = "$env:TEMP\test_order2_xlsx"
if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $extractDir)

$wbXml = [xml](Get-Content "$extractDir\xl\workbook.xml")
$sharedStringsXml = if (Test-Path "$extractDir\xl\sharedStrings.xml") { [xml](Get-Content "$extractDir\xl\sharedStrings.xml") } else { $null }
$strings = @()
if ($sharedStringsXml) {
    foreach ($si in $sharedStringsXml.sst.si) {
        $t = $si.t
        if (-not $t -and $si.r) {
            $t = ($si.r | ForEach-Object { $_.t }) -join ''
        }
        $strings += $t
    }
}

$output = @()
foreach ($sheet in $wbXml.workbook.sheets.sheet) {
    $output += "=========================================="
    $output += "SHEET: $($sheet.name) (r:id $($sheet.'id'))"
    $output += "=========================================="
    $relFile = "$extractDir\xl\_rels\workbook.xml.rels"
    $relsXml = [xml](Get-Content $relFile)
    $relTarget = ($relsXml.Relationships.Relationship | Where-Object { $_.Id -eq $sheet.'id' }).Target
    $sheetFile = "$extractDir\xl\$relTarget"
    
    if (Test-Path $sheetFile) {
        $sheetXml = [xml](Get-Content $sheetFile)
        foreach ($row in $sheetXml.worksheet.sheetData.row) {
            $rowVals = @()
            foreach ($c in $row.c) {
                $v = $c.v
                if ($c.t -eq 's' -and $v -ne $null) {
                    $idx = [int]$v
                    $v = $strings[$idx]
                }
                $rowVals += "$($c.r): $v"
            }
            if ($rowVals.Count -gt 0) {
                $output += ($rowVals -join ' | ')
            }
        }
    }
}
$output | Out-File -FilePath "docs_test_order2_parsed.txt" -Encoding utf8
