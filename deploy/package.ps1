<#
    Builds the Azure App Service deployment package.

    App Service runs `node server/agent.mjs`, which serves both the API and the
    built SPA. The package is self-contained — production dependencies are
    installed here rather than on Azure, so the deploy does not depend on a
    remote build step succeeding.

    Produces deploy/astra.zip with package.json at the archive root, which is
    what `az webapp deploy --type zip` expects.
#>

$ErrorActionPreference = 'Stop'

$root  = Split-Path -Parent $PSScriptRoot
$stage = Join-Path $PSScriptRoot 'package'
$zip   = Join-Path $PSScriptRoot 'astra.zip'

Push-Location $root
try {
    Write-Host 'Building the app...' -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed — not packaging a broken build.' }

    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $stage | Out-Null

    Write-Host 'Staging runtime files...' -ForegroundColor Cyan
    Copy-Item -Path (Join-Path $root 'dist')   -Destination $stage -Recurse
    Copy-Item -Path (Join-Path $root 'server') -Destination $stage -Recurse
    Copy-Item -Path (Join-Path $root 'package.json'), (Join-Path $root 'package-lock.json') -Destination $stage

    # Never ship the local key: it belongs in an App Service setting.
    Get-ChildItem -Path $stage -Filter '.env*' -Recurse -Force -ErrorAction SilentlyContinue |
        Remove-Item -Force

    Write-Host 'Installing production dependencies...' -ForegroundColor Cyan
    Push-Location $stage
    try {
        npm install --omit=dev --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
    } finally { Pop-Location }

    if (Test-Path $zip) { Remove-Item $zip -Force }
    Write-Host 'Compressing...' -ForegroundColor Cyan
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal

    $mb = '{0:N1} MB' -f ((Get-Item $zip).Length / 1MB)
    Write-Host "Package ready: $zip ($mb)" -ForegroundColor Green
}
finally { Pop-Location }
