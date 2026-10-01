param([string]$Encoder = '')
$ErrorActionPreference = 'Stop'
$demoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $demoRoot
$demoWork = Join-Path $demoRoot 'artifacts/v2-demo'
if (-not $Encoder) {
  $Encoder = Join-Path $demoRoot 'artifacts/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
}
if (-not (Test-Path -LiteralPath $Encoder -PathType Leaf)) { throw 'Video encoder not found' }
& node scripts/render-v2-demo.mjs prepare
if ($LASTEXITCODE -ne 0) { throw 'Frame generation failed' }
$scenes = Get-Content -LiteralPath (Join-Path $demoWork 'scenes.json') -Raw | ConvertFrom-Json
foreach ($scene in $scenes) {
    $frame = Join-Path $demoWork ($scene.id + '.png')
    $clip = Join-Path $demoWork ($scene.id + '.mp4')
    & $Encoder -hide_banner -loglevel error -y -loop 1 -framerate 25 -i $frame -t $scene.seconds -an -c:v libx264 -preset veryfast -tune stillimage -crf 20 -pix_fmt yuv420p -movflags +faststart $clip
    if ($LASTEXITCODE -ne 0) { throw ('Video encoding failed for scene ' + $scene.id) }
    Write-Output ('Rendered scene ' + $scene.id + ': ' + $scene.title)
}
& node scripts/render-v2-demo.mjs package
if ($LASTEXITCODE -ne 0) { throw 'Caption packaging failed' }
$video = Join-Path $demoRoot 'frontend/public/demo/quantumsafescan-v2-demo.mp4'
& $Encoder -hide_banner -loglevel error -y -f concat -safe 0 -i (Join-Path $demoWork 'concat.txt') -map 0:v:0 -an -c:v copy -movflags +faststart $video
if ($LASTEXITCODE -ne 0) { throw 'Final video assembly failed' }
Get-Item -LiteralPath $video | Select-Object FullName, Length
