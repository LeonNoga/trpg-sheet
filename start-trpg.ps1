$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$bundledNode = Join-Path (Split-Path $PSScriptRoot -Parent) '.runtime\node_modules\node\bin'
if (Test-Path -LiteralPath $bundledNode) {
  $env:PATH = $bundledNode + ';' + $env:PATH
}
node scripts/copy-ocr-assets.mjs
if ($LASTEXITCODE -ne 0) { throw 'OCR asset preparation failed' }
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort
