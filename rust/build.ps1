# Build do tImago (edicao Rust).
#
#   .\build.ps1                 -> build release + pasta dist-rust\ + zip portatil
#   .\build.ps1 -Installer      -> idem + instalador NSIS (tImago-Setup-x.y.z.exe)
#   .\build.ps1 -Dev            -> build de desenvolvimento (target\debug)
#
# Funciona com o toolchain `x86_64-pc-windows-gnu` do rustup SEM MinGW/MSVC
# instalados. Nesse cenario o Rust precisa de um `dlltool` e o que vem no
# toolchain depende de um assembler ausente; usamos o `llvm-ar` do componente
# `llvm-tools` (ele se comporta como llvm-dlltool quando chamado por esse nome)
# e linkamos com o `rust-lld` (ver .cargo\config.toml).
# (Arquivo em ASCII de proposito: o Windows PowerShell 5.1 le .ps1 sem BOM como ANSI.)

param([switch]$Installer, [switch]$Dev, [string]$DistDir)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$hostTriple = (rustc -vV | Select-String "^host: ").ToString().Substring(6).Trim()
$sysroot = (rustc --print sysroot).Trim()

if ($hostTriple -like "*-windows-gnu") {
    $llvmAr = Join-Path $sysroot "lib\rustlib\$hostTriple\bin\llvm-ar.exe"
    if (-not (Test-Path $llvmAr)) {
        Write-Host "Instalando o componente llvm-tools do rustup..."
        rustup component add llvm-tools
    }
    $tools = Join-Path $PSScriptRoot "target\tools"
    New-Item -ItemType Directory -Force $tools | Out-Null
    Copy-Item $llvmAr (Join-Path $tools "dlltool.exe") -Force
    $env:PATH = "$tools;$env:PATH"
}

$profileDir = if ($Dev) { "debug" } else { "release" }
if ($Dev) { cargo build } else { cargo build --release }
if ($LASTEXITCODE -ne 0) { throw "cargo build falhou" }

$outDir = Join-Path $PSScriptRoot "target\$profileDir"

# No toolchain GNU o WebView2Loader e ligado dinamicamente: a DLL vai junto do exe.
$needsLoader = $hostTriple -like "*-windows-gnu"
if ($needsLoader) {
    $loader = Get-ChildItem (Join-Path $outDir "build\webview2-com-sys-*\out\x64\WebView2Loader.dll") |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $loader) { throw "WebView2Loader.dll nao encontrado na saida do build" }
    Copy-Item $loader.FullName $outDir -Force
}
if ($Dev) { Write-Host "OK: $outDir\tImago.exe"; return }

$version = (Select-String -Path Cargo.toml -Pattern '^version = "(.+)"' | Select-Object -First 1).Matches[0].Groups[1].Value
$dist = if ($DistDir) { $DistDir } else { Join-Path (Split-Path $PSScriptRoot -Parent) "dist-rust" }
$app = Join-Path $dist "tImago"
Remove-Item $app -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $app | Out-Null
Copy-Item (Join-Path $outDir "tImago.exe") $app
if ($needsLoader) { Copy-Item (Join-Path $outDir "WebView2Loader.dll") $app }

$zip = Join-Path $dist "tImago-Portable-$version.zip"
Remove-Item $zip -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $app "*") -DestinationPath $zip
Write-Host "Portatil:   $zip"

if ($Installer) {
    $makensis = (Get-Command makensis -ErrorAction SilentlyContinue).Source
    if (-not $makensis) {
        # Reaproveita o NSIS que o electron-builder ja baixou nesta maquina
        $cached = Get-ChildItem "$env:LOCALAPPDATA\electron-builder\Cache\nsis\nsis-*\Bin\makensis.exe" -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($cached) { $makensis = $cached.FullName }
    }
    if (-not $makensis) { throw "makensis nao encontrado. Instale o NSIS (https://nsis.sourceforge.io) e rode de novo." }
    $setup = Join-Path $dist "tImago-Setup-$version.exe"
    & $makensis /V2 /INPUTCHARSET UTF8 "/DVERSION=$version" "/DAPP_DIR=$app" "/DOUT_FILE=$setup" (Join-Path $PSScriptRoot "installer\timago.nsi")
    if ($LASTEXITCODE -ne 0) { throw "makensis falhou" }
    Write-Host "Instalador: $setup"
}
