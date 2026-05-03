# PowerShell script to convert the build guide to PDF
# Usage: Right-click this file in Explorer -> "Run with PowerShell"
#        OR run from terminal: .\generate_pdf.ps1

Add-Type -AssemblyName System.Web

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$InputFile  = Join-Path $ScriptDir "COMPLETE_BUILD_GUIDE.md"
$OutputPDF  = Join-Path $ScriptDir "COMPLETE_BUILD_GUIDE.pdf"
$OutputHTML = Join-Path $ScriptDir "COMPLETE_BUILD_GUIDE.html"

Write-Host "Lyra Coffee Machine -- Build Guide PDF Generator" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

if (-not (Test-Path $InputFile)) {
    Write-Host "ERROR: $InputFile not found." -ForegroundColor Red
    exit 1
}

# -------------------------------------------------------------------------
# Method 1: pandoc (best output quality)
# -------------------------------------------------------------------------
if (Get-Command pandoc -ErrorAction SilentlyContinue) {
    Write-Host ""
    Write-Host "[pandoc found] Generating PDF..." -ForegroundColor Green

    if (Get-Command wkhtmltopdf -ErrorAction SilentlyContinue) {
        $engine = "wkhtmltopdf"
    } elseif (Get-Command xelatex -ErrorAction SilentlyContinue) {
        $engine = "xelatex"
    } elseif (Get-Command pdflatex -ErrorAction SilentlyContinue) {
        $engine = "pdflatex"
    } else {
        $engine = $null
    }

    $pandocArgs = [System.Collections.Generic.List[string]]::new()
    $pandocArgs.Add($InputFile)
    $pandocArgs.Add("--from"); $pandocArgs.Add("markdown")
    $pandocArgs.Add("--to");   $pandocArgs.Add("pdf")
    $pandocArgs.Add("--output"); $pandocArgs.Add($OutputPDF)
    $pandocArgs.Add("--metadata"); $pandocArgs.Add("title=Lyra Coffee Machine - Complete Build Guide")

    if ($engine -eq "wkhtmltopdf") {
        $pandocArgs.Add("--pdf-engine"); $pandocArgs.Add("wkhtmltopdf")
        $pandocArgs.Add("--variable"); $pandocArgs.Add("margin-top=20mm")
        $pandocArgs.Add("--variable"); $pandocArgs.Add("margin-bottom=20mm")
        $pandocArgs.Add("--variable"); $pandocArgs.Add("margin-left=20mm")
        $pandocArgs.Add("--variable"); $pandocArgs.Add("margin-right=20mm")
        Write-Host "  Using engine: wkhtmltopdf" -ForegroundColor Gray
    } elseif ($null -ne $engine) {
        $pandocArgs.Add("--pdf-engine"); $pandocArgs.Add($engine)
        $pandocArgs.Add("--variable"); $pandocArgs.Add("geometry=margin=2cm")
        $pandocArgs.Add("--variable"); $pandocArgs.Add("fontsize=10pt")
        Write-Host "  Using engine: $engine" -ForegroundColor Gray
    }

    & pandoc $pandocArgs.ToArray()

    if (Test-Path $OutputPDF) {
        Write-Host ""
        Write-Host "SUCCESS: PDF created:" -ForegroundColor Green
        Write-Host "  $OutputPDF" -ForegroundColor Yellow
        Start-Process $OutputPDF
    } else {
        Write-Host "ERROR: PDF was not created. Check pandoc output above." -ForegroundColor Red
    }

# -------------------------------------------------------------------------
# Method 2: HTML fallback (open in browser -> Ctrl+P -> Save as PDF)
# -------------------------------------------------------------------------
} else {
    Write-Host ""
    Write-Host "[pandoc NOT found] Using HTML fallback..." -ForegroundColor Yellow
    Write-Host ""

    $md = Get-Content $InputFile -Encoding UTF8

    $cssLines = @(
        "body { font-family: Segoe UI, Arial, sans-serif; max-width: 900px; margin: 40px auto; color: #222; }",
        "h1 { color: #1a3a5c; border-bottom: 3px solid #1a3a5c; padding-bottom: 8px; }",
        "h2 { color: #1a3a5c; border-bottom: 1px solid #aaa; margin-top: 36px; }",
        "h3 { color: #2a5a8c; margin-top: 24px; }",
        "pre, code { background: #f4f4f4; border: 1px solid #ddd; border-radius: 4px; }",
        "pre { padding: 12px; overflow-x: auto; font-family: Consolas, monospace; font-size: 12px; }",
        "code { padding: 2px 5px; font-family: Consolas, monospace; }",
        "table { border-collapse: collapse; width: 100%; margin: 12px 0; }",
        "th { background: #1a3a5c; color: white; padding: 8px 10px; text-align: left; }",
        "td { padding: 7px 10px; border: 1px solid #ccc; }",
        "tr:nth-child(even) { background: #f9f9f9; }",
        "blockquote { border-left: 4px solid #e07000; background: #fff8f0; padding: 10px 16px; margin: 16px 0; }",
        "@media print { body { max-width: 100%; } h2 { page-break-before: always; } pre { white-space: pre-wrap; } }"
    )
    $css = $cssLines -join "`n"

    $script:out = [System.Collections.Generic.List[string]]::new()
    $out = $script:out
    $out.Add("<!DOCTYPE html>")
    $out.Add("<html lang=`"en`">")
    $out.Add("<head>")
    $out.Add("<meta charset=`"UTF-8`">")
    $out.Add("<meta name=`"viewport`" content=`"width=device-width, initial-scale=1`">")
    $out.Add("<title>Lyra Coffee Machine - Complete Build Guide</title>")
    $out.Add("<style>"); $out.Add($css); $out.Add("</style>")
    $out.Add("</head>")
    $out.Add("<body>")
    $out.Add("<p><em><strong>To create PDF:</strong> Press Ctrl+P in your browser &rarr; Destination: Save as PDF &rarr; Save</em></p>")
    $out.Add("<hr>")

    $inCode = $false
    $script:tableBuffer = [System.Collections.Generic.List[string]]::new()
    $tableBuffer = $script:tableBuffer

    function Flush-Table {
        if ($script:tableBuffer.Count -eq 0) { return }
        $isHead = $true
        $script:out.Add("<table>")
        foreach ($row in $script:tableBuffer) {
            if ($row -match '^\|[-| :]+\|$') { $isHead = $false; continue }
            $cells = $row -split '\|' | Where-Object { $_.Trim() -ne '' }
            $tr = "  <tr>"
            foreach ($c in $cells) {
                $tag = if ($isHead) { "th" } else { "td" }
                $tr += "<$tag>$($c.Trim())</$tag>"
            }
            $tr += "</tr>"
            $script:out.Add($tr)
            $isHead = $false
        }
        $script:out.Add("</table>")
        $script:tableBuffer.Clear()
    }

    foreach ($line in $md) {
        if ($line -match '^```') {
            if (-not $inCode) {
                Flush-Table
                $out.Add("<pre><code>")
                $inCode = $true
            } else {
                $out.Add("</code></pre>")
                $inCode = $false
            }
            continue
        }
        if ($inCode) {
            $escaped = [System.Web.HttpUtility]::HtmlEncode($line)
            $out.Add($escaped)
            continue
        }
        if ($line -match '^\|') {
            $tableBuffer.Add($line)
            continue
        }
        Flush-Table

        if    ($line -match '^#####\s+(.+)') { $out.Add("<h5>$($Matches[1])</h5>") }
        elseif($line -match '^####\s+(.+)')  { $out.Add("<h4>$($Matches[1])</h4>") }
        elseif($line -match '^###\s+(.+)')   { $out.Add("<h3>$($Matches[1])</h3>") }
        elseif($line -match '^##\s+(.+)')    { $out.Add("<h2>$($Matches[1])</h2>") }
        elseif($line -match '^#\s+(.+)')     { $out.Add("<h1>$($Matches[1])</h1>") }
        elseif($line -match '^>\s+(.+)')     { $out.Add("<blockquote>$($Matches[1])</blockquote>") }
        elseif($line -match '^-{3,}$')       { $out.Add("<hr>") }
        elseif($line.Trim() -eq '')          { $out.Add("") }
        else {
            $esc = [System.Web.HttpUtility]::HtmlEncode($line)
            $esc = $esc -replace '`([^`]+)`', '<code>$1</code>'
            $esc = $esc -replace '\*\*([^*]+)\*\*', '<strong>$1</strong>'
            $esc = $esc -replace '\*([^*]+)\*', '<em>$1</em>'
            $out.Add("<p>$esc</p>")
        }
    }
    Flush-Table
    $out.Add("</body></html>")

    [System.IO.File]::WriteAllLines($OutputHTML, $out, [System.Text.Encoding]::UTF8)

    Write-Host "HTML file created:" -ForegroundColor Green
    Write-Host "  $OutputHTML" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Steps to save as PDF:" -ForegroundColor Cyan
    Write-Host "  1. File will open in your browser now"
    Write-Host "  2. Press Ctrl+P"
    Write-Host "  3. Set Destination to 'Save as PDF'"
    Write-Host "  4. Click Save"
    Write-Host ""
    Start-Process $OutputHTML
}

Write-Host ""
Write-Host "To install pandoc for better PDF quality:" -ForegroundColor DarkGray
Write-Host "  winget install pandoc" -ForegroundColor DarkGray
Write-Host "Done." -ForegroundColor Green
