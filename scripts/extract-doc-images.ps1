param(
    [string]$DocPath = (Join-Path (Split-Path $PSScriptRoot) "APR2026- CATALOGUE.doc"),
    [string]$OutDir  = (Join-Path (Split-Path $PSScriptRoot) "temp\doc-images")
)

New-Item -ItemType Directory -Force $OutDir | Out-Null
$DocPath = (Resolve-Path $DocPath).Path
Write-Host "Opening: $DocPath"

# --- Convert .doc → .docx via Word COM ---
$word = $null
$docxPath = Join-Path $env:TEMP "catalogue-temp.docx"
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0

    $doc = $word.Documents.Open($DocPath)
    $doc.SaveAs2($docxPath, 16)   # 16 = wdFormatXMLDocument (.docx)
    $doc.Close($false)
    Write-Host "Converted to: $docxPath"
} catch {
    Write-Error "Word COM failed: $_"
    exit 1
} finally {
    if ($word) {
        try { $word.Quit() } catch {}
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    }
}

# --- Unzip .docx ---
$extractDir = Join-Path $env:TEMP "catalogue-docx-extracted"
if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
Expand-Archive -Path $docxPath -DestinationPath $extractDir -Force

$mediaDir = Join-Path $extractDir "word\media"
if (-not (Test-Path $mediaDir)) {
    Write-Error "No word/media directory in docx — document has no embedded images"
    exit 1
}

$mediaFiles = Get-ChildItem $mediaDir -File |
    Where-Object { $_.Extension -match "\.(png|jpg|jpeg|gif|bmp|tiff)$" } |
    Sort-Object Name

Write-Host "Raw media files: $($mediaFiles.Count)"

# --- Filter: skip logos/banners, keep product photos ---
Add-Type -AssemblyName System.Drawing

$productImages = [System.Collections.Generic.List[string]]::new()
foreach ($file in $mediaFiles) {
    try {
        $img = [System.Drawing.Image]::FromFile($file.FullName)
        $w   = $img.Width
        $h   = $img.Height
        $img.Dispose()

        if ($w -lt 100 -or $h -lt 100)     { continue }  # too small (icon/logo)
        if ($h -gt 0 -and ($w / $h) -gt 3) { continue }  # too wide (banner)

        $productImages.Add($file.FullName)
    } catch {
        continue   # skip EMF/WMF vector formats
    }
}

Write-Host "After filter: $($productImages.Count) product images"

# --- Copy with sequential names ---
for ($i = 0; $i -lt $productImages.Count; $i++) {
    $num  = $i + 1
    $src  = $productImages[$i]
    $ext  = [System.IO.Path]::GetExtension($src).ToLower()
    $dest = Join-Path $OutDir "extracted-$num$ext"
    Copy-Item $src $dest
}

Write-Host "COUNT:$($productImages.Count)"
Write-Host "Done. Saved to: $OutDir"
