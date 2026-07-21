Add-Type -AssemblyName System.Drawing

$sourcePath = "c:\Users\user\Desktop\RAON.I\public\images\feature_graphic.png"
$backupPath = "c:\Users\user\Desktop\RAON.I\public\images\feature_graphic_original.png"

# 백업 복사
if (-not (Test-Path $backupPath)) {
    Copy-Item $sourcePath $backupPath
}

Write-Host "이미지 로드 중: $sourcePath"
$img = [System.Drawing.Image]::FromFile($sourcePath)

Write-Host "원본 이미지 해상도: $($img.Width) x $($img.Height)"

# 1024x1024 중 한가운데 500px 영역 자르기
# Y 시작 지점 = (1024 - 500) / 2 = 262
$bmp = New-Object System.Drawing.Bitmap(1024, 500)
$graph = [System.Drawing.Graphics]::FromImage($bmp)
$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

$graph.DrawImage($img, 
    (New-Object System.Drawing.Rectangle(0, 0, 1024, 500)), 
    0, 262, 1024, 500, 
    [System.Drawing.GraphicsUnit]::Pixel
)

$img.Dispose()
$graph.Dispose()

# 저장 시 기존 파일 덮어쓰기 위해 강제 쓰기
Write-Host "1024x500 해상도로 저장 중..."
$bmp.Save($sourcePath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "✅ 변환 완료!"
