param(
  [Parameter(Mandatory = $true)]
  [string]$InputPng,

  [string]$OutputIco = "electron/assets/icon.ico"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path -LiteralPath $InputPng)) {
  throw "Input image not found: $InputPng"
}

$outputDir = Split-Path -Parent $OutputIco
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$sizes = @(16, 32, 48, 64, 128, 256)
$iconImages = New-Object System.Collections.Generic.List[object]

$sourceImage = [System.Drawing.Image]::FromFile($InputPng)
try {
  foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
      }
      finally {
        $graphics.Dispose()
      }

      $ms = New-Object System.IO.MemoryStream
      try {
        $bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBytes = $ms.ToArray()
      }
      finally {
        $ms.Dispose()
      }

      $entry = [PSCustomObject]@{
        Size = $size
        Bytes = $pngBytes
      }
      $iconImages.Add($entry)
    }
    finally {
      $bitmap.Dispose()
    }
  }
}
finally {
  $sourceImage.Dispose()
}

$fileStream = [System.IO.File]::Open($OutputIco, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
try {
  $writer = New-Object System.IO.BinaryWriter($fileStream)
  try {
    # ICO header
    $writer.Write([UInt16]0) # Reserved
    $writer.Write([UInt16]1) # Type: Icon
    $writer.Write([UInt16]$iconImages.Count) # Image count

    $offset = 6 + (16 * $iconImages.Count)

    foreach ($img in $iconImages) {
      $sizeByte = if ($img.Size -eq 256) { 0 } else { [byte]$img.Size }
      $writer.Write([byte]$sizeByte) # Width
      $writer.Write([byte]$sizeByte) # Height
      $writer.Write([byte]0)         # Color palette count
      $writer.Write([byte]0)         # Reserved
      $writer.Write([UInt16]1)       # Color planes
      $writer.Write([UInt16]32)      # Bits per pixel
      $writer.Write([UInt32]$img.Bytes.Length)
      $writer.Write([UInt32]$offset)
      $offset += $img.Bytes.Length
    }

    foreach ($img in $iconImages) {
      $writer.Write($img.Bytes)
    }
  }
  finally {
    $writer.Dispose()
  }
}
finally {
  $fileStream.Dispose()
}

Write-Host "Created icon: $OutputIco"
