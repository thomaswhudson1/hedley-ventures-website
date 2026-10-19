# Builds Thomas Hudson's Hedley Ventures email signature from the approved "Test 1" signature
# (Marketing material\Email Signature\Thomas_Hudson_Email_Signature_Latest.html on the G drive).
# The photo and logo are cut, at the same scale, from that signature's combined image so they can be
# spaced and linked separately. Run: powershell -ExecutionPolicy Bypass -File build.ps1 [-LogoGap 10]
param([int]$LogoGap = 10)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$repo = Split-Path $root -Parent
$assets = Join-Path $repo 'dist\assets\email-signature'
New-Item -ItemType Directory -Force $assets | Out-Null
Add-Type -AssemblyName System.Drawing

# The original combined image (308x421) is shown at 113x154, so 1 display px = 308/113 source px.
$k = 308 / 113
function Cut([string]$name, [double]$srcY, [int]$w, [int]$h) {
  $src = [Drawing.Image]::FromFile((Join-Path $root 'src\photo-and-logo-original.png'))
  $out = New-Object Drawing.Bitmap ($w * 2), ($h * 2)          # 2x for sharp display on high-DPI screens
  $g = [Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.SmoothingMode = 'HighQuality'
  $g.Clear([Drawing.Color]::White)
  $ia = New-Object Drawing.Imaging.ImageAttributes; $ia.SetWrapMode('TileFlipXY')
  $g.DrawImage($src, (New-Object Drawing.Rectangle 0, 0, ($w * 2), ($h * 2)), 0, $srcY, ($w * $k), ($h * $k), 'Pixel', $ia)
  $g.Dispose(); $src.Dispose()
  $out.Save((Join-Path $assets $name), [Drawing.Imaging.ImageFormat]::Png); $out.Dispose()
}
# Photo: top of the original image down past the bottom of the circle (source row 287).
Cut 'thomas-hudson.png' 0 113 107
# Logo: cropped so the artwork (last source row 399) ends 0.6px above the image bottom, which puts its
# lowest visible pixels level with the bottom of the 'hedleyventures.com' text.
Cut 'hedley-ventures-logo.png' (400 + 0.6 * $k - 26 * $k) 113 26
foreach ($i in 'phone', 'email', 'linkedin', 'website') { Copy-Item (Join-Path $root "src\icon-$i.png") (Join-Path $assets "icon-$i.png") -Force }

$web = 'https://hedleyventures.com'
$li = 'https://www.linkedin.com/company/hedleyventures/'
$sans = "font-family:'Rethink Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;color:#12222b;white-space:nowrap;"
$img = 'display:block;border:0;outline:none;text-decoration:none;'
function Row([string]$icon, [string]$href, [string]$text, [int]$gap) {
@"
        <tr>
          <td style="padding:0 0 ${gap}px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td valign="middle" style="padding:0 9px 0 0;"><a href="$href" style="text-decoration:none;"><img src="{BASE}icon-$icon.png" width="16" height="16" alt="" style="$img"></a></td>
                <td valign="middle" style="${sans}padding:0;"><a href="$href" style="color:#12222b;text-decoration:none;">$text</a></td>
              </tr>
            </table>
          </td>
        </tr>
"@
}
$sig = @"
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#ffffff;margin:0;padding:0;">
  <tr>
    <td valign="top" style="padding:17px 25px 22px 0;margin:0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:0;"><img src="{BASE}thomas-hudson.png" width="113" height="107" alt="Thomas Hudson" style="$img"></td>
        </tr>
        <tr>
          <td style="padding:${LogoGap}px 0 0 0;"><a href="$web" style="text-decoration:none;"><img src="{BASE}hedley-ventures-logo.png" width="113" height="26" alt="Hedley Ventures" style="$img"></a></td>
        </tr>
      </table>
    </td>
    <td valign="top" style="padding:25px 25px 22px 0;margin:0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td style="font-family:'DM Serif Display',Georgia,'Times New Roman',serif;font-size:20px;line-height:22px;color:#173455;font-weight:400;padding:0;white-space:nowrap;">Thomas Hudson</td>
        </tr>
        <tr>
          <td style="font-size:6px;line-height:6px;padding:0;">&nbsp;</td>
        </tr>
        <tr>
          <td style="font-family:'Rethink Sans',Arial,Helvetica,sans-serif;font-size:10px;line-height:14px;color:#967f51;font-weight:bold;padding:0;white-space:nowrap;">Managing Director&nbsp;|&nbsp;Growth Capital &amp; CFO Advisory</td>
        </tr>
        <tr>
          <td style="font-size:12px;line-height:12px;padding:0;">&nbsp;</td>
        </tr>
$(Row 'phone' 'tel:+447718978627' '+44 7718 978 627' 6)$(Row 'email' 'mailto:thudson@hedleyventures.com' 'thudson@hedleyventures.com' 6)$(Row 'linkedin' $li 'Hedley Ventures' 6)$(Row 'website' $web 'hedleyventures.com' 0)      </table>
    </td>
  </tr>
</table>
"@

$utf8 = New-Object Text.UTF8Encoding($false)
# 1. The signature to install: images load from the live website.
$install = @"
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Thomas Hudson email signature</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
<!-- Open this file in Chrome or Edge, press Ctrl+A then Ctrl+C, and paste into Gmail's signature box. -->
$($sig.Replace('{BASE}', 'https://hedleyventures.com/assets/email-signature/'))
</body>
</html>
"@
[IO.File]::WriteAllText((Join-Path $root 'hedley-ventures-email-signature.html'), $install, $utf8)
# 2. Preview: identical signature, images loaded from this computer so it works before the website is updated.
$preview = @"
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Email signature preview</title>
</head>
<body style="margin:0;padding:40px;background:#ffffff;">
$($sig.Replace('{BASE}', '../dist/assets/email-signature/'))
</body>
</html>
"@
[IO.File]::WriteAllText((Join-Path $root 'preview.html'), $preview, $utf8)
"built (logo gap $LogoGap px)"
