# Installs Taobao Clean: Tampermonkey (if missing) and then the userscript.
# Usage: irm https://raw.githubusercontent.com/trongio/taobao-clean/main/install.ps1 | iex
#        & ([scriptblock]::Create((irm https://raw.githubusercontent.com/trongio/taobao-clean/main/install.ps1))) edge
# Browsers: chrome (default), edge, brave, firefox

# No param() block so the same file works with both `| iex` and the scriptblock form.
$Browser = if ($args.Count -gt 0) { "$($args[0])".ToLower() } elseif ($env:TAOBAO_CLEAN_BROWSER) { $env:TAOBAO_CLEAN_BROWSER } else { 'chrome' }
if ($Browser -notin 'chrome', 'edge', 'brave', 'firefox') { Write-Host "Unknown browser '$Browser'. Use: chrome, edge, brave, firefox" -ForegroundColor Red; return }

$ErrorActionPreference = 'Stop'
$ScriptUrl = 'https://raw.githubusercontent.com/trongio/taobao-clean/main/taobao-clean.user.js'

$info = @{
    chrome  = @{ Exe = 'chrome.exe'; Profile = "$env:LOCALAPPDATA\Google\Chrome\User Data"
                 Paths = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe")
                 Id = 'dhdgffkkebhmkfjojejmpbldmpobfkfo'; Store = 'https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo'; Ext = 'chrome://extensions/?id=' }
    edge    = @{ Exe = 'msedge.exe'; Profile = "$env:LOCALAPPDATA\Microsoft\Edge\User Data"
                 Paths = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")
                 Id = 'iikmkjmpaadaobahmlepeloendndfphd'; Store = 'https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd'; Ext = 'edge://extensions/?id=' }
    brave   = @{ Exe = 'brave.exe'; Profile = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data"
                 Paths = @("$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe", "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe", "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe")
                 Id = 'dhdgffkkebhmkfjojejmpbldmpobfkfo'; Store = 'https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo'; Ext = 'brave://extensions/?id=' }
    firefox = @{ Exe = 'firefox.exe'; Profile = "$env:APPDATA\Mozilla\Firefox\Profiles"
                 Paths = @("$env:ProgramFiles\Mozilla Firefox\firefox.exe", "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe")
                 Id = 'firefox@tampermonkey.net'; Store = 'https://addons.mozilla.org/firefox/addon/tampermonkey/'; Ext = $null }
}[$Browser]

# Find the browser: registry App Paths first, then the usual install folders.
$exe = $null
foreach ($root in 'HKCU:', 'HKLM:') {
    $key = "$root\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$($info.Exe)"
    if (Test-Path $key) {
        $exe = "$((Get-ItemProperty $key).'(default)')".Trim('"')
        if ($exe -and (Test-Path $exe) -and ((Split-Path $exe -Leaf) -eq $info.Exe)) { break } else { $exe = $null }
    }
}
if (-not $exe) { $exe = $info.Paths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1 }
if (-not $exe) { Write-Host "Could not find $Browser. Install it, or pass another browser (edge, firefox, brave)." -ForegroundColor Red; return }

function Open-Url($url) { Start-Process -FilePath $exe -ArgumentList $url }
function Wait-Enter($msg) { Write-Host ''; Write-Host $msg -ForegroundColor Yellow; [void](Read-Host 'Press Enter when done') }

if ($Browser -eq 'firefox') {
    $installed = Get-ChildItem "$($info.Profile)\*\extensions\$($info.Id).xpi" -ErrorAction SilentlyContinue
} else {
    $installed = Get-ChildItem "$($info.Profile)\*\Extensions\$($info.Id)" -Directory -ErrorAction SilentlyContinue
}

Write-Host "Taobao Clean installer ($Browser)" -ForegroundColor Cyan
Write-Host "Using: $exe"

if (-not $installed) {
    Write-Host 'Step 1: install Tampermonkey (it runs the script).'
    Open-Url $info.Store
    Wait-Enter "In the browser tab that opened, click 'Add to $Browser' / 'Get' and confirm."
    if ($info.Ext) {
        Open-Url ($info.Ext + $info.Id)
        Wait-Enter "On the Tampermonkey details page, turn ON 'Allow User Scripts' (or 'Developer mode' if that toggle is missing)."
    }
} else {
    Write-Host 'Tampermonkey is already installed, skipping step 1.'
}

Write-Host 'Step 2: install the Taobao Clean script.'
Open-Url $ScriptUrl
Write-Host "In the Tampermonkey tab that opened, click 'Install'. Then open https://www.taobao.com and you're done." -ForegroundColor Green
