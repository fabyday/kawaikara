$ErrorActionPreference = 'Stop'

$sdkLock = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'windows-libmpv.lock.json') -Raw | ConvertFrom-Json
if ($sdkLock.sha256 -notmatch '^[0-9a-f]{64}$' -or
    $sdkLock.url -notmatch '^https://github\.com/shinchiro/mpv-winbuild-cmake/releases/download/[^/]+/mpv-dev-x86_64-[^/]+\.7z$') {
  throw 'Invalid pinned libmpv archive URL or SHA-256.'
}
if (-not $env:RUNNER_TEMP) { throw 'RUNNER_TEMP must be set to the build temporary directory.' }
$sdkRoot = Join-Path $env:USERPROFILE 'libmpv'
$tempRoot = Join-Path $env:RUNNER_TEMP 'kawaikara-libmpv'
$archivePath = Join-Path $tempRoot 'libmpv.7z'
$extractRoot = Join-Path $tempRoot ([guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force -Path $tempRoot, $extractRoot | Out-Null

if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
  try {
    # Public pinned assets need no API lookup or authorization header.
    # Do not retry rate limits or restart the workflow automatically.
    Invoke-WebRequest -Uri $sdkLock.url -OutFile $archivePath -TimeoutSec 180
  } catch {
    throw "libmpv download failed. No automatic retry was attempted. If GitHub reports a rate limit, wait until its reset time, then manually run Nightly again. $($_.Exception.Message)"
  }
} else {
  Write-Host "Using cached libmpv archive ($($sdkLock.version)); no download needed."
}

$actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $sdkLock.sha256) {
  throw 'libmpv SHA-256 mismatch. Refusing to extract or cache this archive. Remove the affected Actions cache before manually rerunning.'
}

# Always extract verified bytes, even when an older SDK already exists locally.
& {
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
