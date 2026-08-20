$ErrorActionPreference = 'Stop'

$sdkRoot = Join-Path $env:USERPROFILE 'libmpv'
$tempRoot = Join-Path $env:RUNNER_TEMP 'kawaikara-libmpv'
$archivePath = Join-Path $tempRoot 'libmpv.7z'
$extractRoot = Join-Path $tempRoot 'extracted'
New-Item -ItemType Directory -Force -Path $tempRoot, $extractRoot | Out-Null

$headersReady = Test-Path (Join-Path $sdkRoot 'include\mpv\client.h')
$dllReady = Test-Path (Join-Path $sdkRoot 'bin\libmpv-2.dll')
if (-not ($headersReady -and $dllReady)) {
  $release = Invoke-RestMethod `
    -Headers @{ Accept = 'application/vnd.github+json' } `
    -Uri 'https://api.github.com/repos/shinchiro/mpv-winbuild-cmake/releases/latest'
  $asset = $release.assets |
    Where-Object { $_.name -match '^mpv-dev-x86_64-.*\.7z$' -and $_.name -notmatch '-v3-' } |
    Select-Object -First 1
  if (-not $asset) {
    throw 'The latest mpv-winbuild release has no non-v3 x86_64 development archive.'
  }

  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archivePath
  & 7z.exe x $archivePath "-o$extractRoot" -y | Out-Host
  if ($LASTEXITCODE -ne 0) { throw '7-Zip could not extract the libmpv SDK.' }

  $clientHeader = Get-ChildItem $extractRoot -Recurse -File -Filter client.h |
    Where-Object { $_.Directory.Name -eq 'mpv' } |
    Select-Object -First 1
  $runtimeDll = Get-ChildItem $extractRoot -Recurse -File |
    Where-Object { $_.Name -in @('libmpv-2.dll', 'mpv-2.dll') } |
    Select-Object -First 1
  if (-not $clientHeader -or -not $runtimeDll) {
    throw 'The downloaded development archive does not contain libmpv headers and runtime.'
  }

  New-Item -ItemType Directory -Force `
    -Path (Join-Path $sdkRoot 'include'), (Join-Path $sdkRoot 'bin') | Out-Null
  Copy-Item (Join-Path $clientHeader.Directory.Parent.FullName '*') `
    (Join-Path $sdkRoot 'include') -Recurse -Force
  Get-ChildItem $runtimeDll.Directory.FullName -File -Filter '*.dll' |
    Copy-Item -Destination (Join-Path $sdkRoot 'bin') -Force
}

$dllPath = Get-ChildItem (Join-Path $sdkRoot 'bin') -File |
  Where-Object { $_.Name -in @('libmpv-2.dll', 'mpv-2.dll') } |
  Select-Object -First 1
$outputPath = Join-Path $sdkRoot 'lib\mpv.lib'
$defPath = Join-Path $sdkRoot 'lib\mpv.def'
$exports = & dumpbin.exe /nologo /exports $dllPath.FullName |
  Select-String '^\s+\d+\s+[0-9A-Fa-f]+\s+[0-9A-Fa-f]+\s+(\S+)' |
  ForEach-Object { $_.Matches[0].Groups[1].Value }
if ($LASTEXITCODE -ne 0 -or $exports.Count -eq 0) {
  throw 'Unable to read libmpv exports with dumpbin.exe.'
}
New-Item -ItemType Directory -Force -Path (Split-Path $outputPath) | Out-Null
@("LIBRARY $($dllPath.Name)", 'EXPORTS') + $exports |
  Set-Content -Path $defPath -Encoding ascii
& lib.exe /nologo "/def:$defPath" "/out:$outputPath" /machine:x64
if ($LASTEXITCODE -ne 0) { throw 'lib.exe could not create mpv.lib.' }
Write-Host "Prepared libmpv SDK at $sdkRoot"
