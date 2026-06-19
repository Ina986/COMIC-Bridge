param(
    [string]$RepoRoot = "",
    [string[]]$TargetPath = @(),
    [string]$Directory = ""
)

$ErrorActionPreference = "Stop"

function Find-SignTool {
    if ($env:SIGNTOOL_PATH -and (Test-Path -LiteralPath $env:SIGNTOOL_PATH)) {
        return (Resolve-Path -LiteralPath $env:SIGNTOOL_PATH).Path
    }

    $cmd = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $kitRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
    if (Test-Path -LiteralPath $kitRoot) {
        $candidate = Get-ChildItem -LiteralPath $kitRoot -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match "\\x64\\signtool\.exe$" } |
            Sort-Object FullName -Descending |
            Select-Object -First 1
        if ($candidate) {
            return $candidate.FullName
        }
    }

    throw "signtool.exe was not found. Install Windows SDK or set SIGNTOOL_PATH."
}

function Get-DefaultTargets {
    if ($RepoRoot) {
        if (-not (Test-Path -LiteralPath $RepoRoot)) {
            throw "RepoRoot not found: $RepoRoot"
        }
        $repoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
    } else {
        $repoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
    }
    $patterns = @(
        "src-tauri\target\release\*.exe",
        "src-tauri\target\release\*.dll",
        "src-tauri\target\release\bundle\nsis\*.exe",
        "src-tauri\target\release\bundle\nsis\*.dll",
        "src-tauri\target\release\bundle\nsis\*.msi",
        "src-tauri\target\release\bundle\msi\*.msi"
    )

    $items = foreach ($pattern in $patterns) {
        Get-ChildItem -Path (Join-Path $repoRoot $pattern) -File -ErrorAction SilentlyContinue
    }

    return $items | Sort-Object FullName -Unique
}

$targets = @()

if ($TargetPath.Count -gt 0) {
    foreach ($path in $TargetPath) {
        if (-not (Test-Path -LiteralPath $path)) {
            throw "Target not found: $path"
        }
        $item = Get-Item -LiteralPath $path
        if ($item.PSIsContainer) {
            $targets += Get-ChildItem -LiteralPath $item.FullName -File -Recurse -Include *.exe,*.dll,*.msi
        } else {
            $targets += $item
        }
    }
} elseif ($Directory) {
    if (-not (Test-Path -LiteralPath $Directory)) {
        throw "Directory not found: $Directory"
    }
    $targets = Get-ChildItem -LiteralPath $Directory -File -Recurse -Include *.exe,*.dll,*.msi
} else {
    $targets = Get-DefaultTargets
}

$targets = @($targets | Sort-Object FullName -Unique)
if ($targets.Count -eq 0) {
    throw "No signable files found. Build the Tauri app first or pass -TargetPath/-Directory."
}

$pfxPath = $env:CODESIGN_PFX_PATH
$pfxPassword = $env:CODESIGN_PFX_PASSWORD
$certSha1 = $env:CODESIGN_CERT_SHA1
$timestampUrl = if ($env:CODESIGN_TIMESTAMP_URL) { $env:CODESIGN_TIMESTAMP_URL } else { "http://timestamp.digicert.com" }

if (-not $pfxPath -and -not $certSha1) {
    throw "Set CODESIGN_PFX_PATH plus CODESIGN_PFX_PASSWORD, or set CODESIGN_CERT_SHA1 for a certificate in the Windows cert store."
}

if ($pfxPath -and -not (Test-Path -LiteralPath $pfxPath)) {
    throw "CODESIGN_PFX_PATH not found: $pfxPath"
}

$signtool = Find-SignTool
Write-Host "Using signtool: $signtool"
Write-Host "Timestamp URL: $timestampUrl"

foreach ($target in $targets) {
    Write-Host "Signing: $($target.FullName)"

    $signArgs = @("sign", "/fd", "SHA256", "/tr", $timestampUrl, "/td", "SHA256")
    if ($pfxPath) {
        $signArgs += @("/f", $pfxPath)
        if ($pfxPassword) {
            $signArgs += @("/p", $pfxPassword)
        }
    } else {
        $signArgs += @("/sha1", $certSha1)
    }
    $signArgs += $target.FullName

    & $signtool @signArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Signing failed: $($target.FullName)"
    }

    & $signtool verify /pa /all $target.FullName
    if ($LASTEXITCODE -ne 0) {
        throw "Signature verification failed: $($target.FullName)"
    }
}

Write-Host "Windows signing completed: $($targets.Count) file(s)."
