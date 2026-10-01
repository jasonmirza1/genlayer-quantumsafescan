param(
  [string]$Encoder = '',
  [string]$Voice = 'Microsoft Zira Desktop'
)
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
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice($Voice)
$speaker.Rate = 0
$speaker.Volume = 100
$scenes = Get-Content -LiteralPath (Join-Path $demoWork 'scenes.json') -Raw | ConvertFrom-Json
try {
  foreach ($scene in $scenes) {
    $wave = Join-Path $demoWork ($scene.id + '.wav')
    $speaker.SetOutputToWaveFile($wave)
    $speaker.Speak($scene.narration)
    $speaker.SetOutputToNull()
    $frame = Join-Path $demoWork ($scene.id + '.png')
    $clip = Join-Path $demoWork ($scene.id + '.mp4')
    & $Encoder -hide_banner -loglevel error -y -loop 1 -framerate 25 -i $frame -i $wave -c:v libx264 -preset veryfast -tune stillimage -crf 20 -pix_fmt yuv420p -af 'apad=pad_dur=1.2' -c:a aac -b:a 128k -ar 48000 -shortest -movflags +faststart $clip
    if ($LASTEXITCODE -ne 0) { throw ('Video encoding failed for scene ' + $scene.id) }
    Write-Output ('Rendered scene ' + $scene.id + ': ' + $scene.title)
  }
} finally { $speaker.Dispose() }
& node scripts/render-v2-demo.mjs package
if ($LASTEXITCODE -ne 0) { throw 'Caption packaging failed' }
$video = Join-Path $demoRoot 'frontend/public/demo/quantumsafescan-v2-demo.mp4'
& $Encoder -hide_banner -loglevel error -y -f concat -safe 0 -i (Join-Path $demoWork 'concat.txt') -c copy -movflags +faststart $video
if ($LASTEXITCODE -ne 0) { throw 'Final video assembly failed' }
Get-Item -LiteralPath $video | Select-Object FullName, Length
