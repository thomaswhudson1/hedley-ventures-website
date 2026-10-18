# Builds the Hedley Ventures LinkedIn banners (1128x191 and 2x) and LinkedIn page mock-ups from HTML,
# using the website's own fonts and colours. Run: powershell -ExecutionPolicy Bypass -File build.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$repo = Split-Path $root -Parent
$assets = ($repo + '\dist\assets').Replace('\', '/')
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$work = Join-Path $root 'src\_html'; New-Item -ItemType Directory -Force $work, (Join-Path $root 'banners'), (Join-Path $root 'mockups') | Out-Null

# Brand tokens taken from dist/assets/site.css
$navy = '#001e2a'; $cream = '#eeebe8'; $lightGold = '#b9a16a'; $brandGold = '#967f51'
$fonts = @"
@font-face{font-family:DMSerif;src:url('file:///$assets/dm-serif.ttf')}
@font-face{font-family:Rethink;src:url('file:///$assets/rethink-medium.ttf');font-weight:500}
@font-face{font-family:Rethink;src:url('file:///$assets/rethink-semibold.ttf');font-weight:600}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1128px;height:191px;overflow:hidden}
.b{position:relative;width:1128px;height:191px;overflow:hidden}
h1{font-family:DMSerif,Georgia,serif;font-weight:400;letter-spacing:-.015em;line-height:1.08}
h1 span{display:block}
"@

$designs = [ordered]@{
  # 1. Navy, centred slightly right, cream + light gold
  'hedley-linkedin-banner-1-navy' = @"
<div class="b" style="background:$navy">
  <h1 style="position:absolute;left:330px;right:110px;top:50%;transform:translateY(-50%);text-align:center;font-size:44px">
    <span style="color:$cream">Capital for growth</span><span style="color:$lightGold">Financial leadership to scale</span></h1>
</div>
"@
  # 2. Cream, centred slightly right, navy + brand gold (light gold is too faint on cream)
  'hedley-linkedin-banner-2-cream' = @"
<div class="b" style="background:$cream">
  <h1 style="position:absolute;left:330px;right:110px;top:50%;transform:translateY(-50%);text-align:center;font-size:44px">
    <span style="color:$navy">Capital for growth</span><span style="color:$brandGold">Financial leadership to scale</span></h1>
</div>
"@
  # 3. Homepage-hero composition: left-aligned headline (clear of the logo), hairline, web address
  'hedley-linkedin-banner-3-hero' = @"
<div class="b" style="background:$navy">
  <h1 style="position:absolute;left:290px;top:50%;transform:translateY(-50%);font-size:41px;text-align:left">
    <span style="color:#fff">Capital for growth</span><span style="color:$lightGold">Financial leadership to scale</span></h1>
  <div style="position:absolute;right:64px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:18px">
    <span style="display:block;width:1px;height:58px;background:$lightGold;opacity:.7"></span>
    <span style="font-family:Rethink,Arial,sans-serif;font-weight:500;font-size:15px;letter-spacing:.04em;color:#d8dfe0">hedleyventures.com</span>
  </div>
</div>
"@
}

function Shot($html, $png, $w, $h, $scale) {
  $file = Join-Path $work ([IO.Path]::GetFileNameWithoutExtension($png) + '.html')
  [IO.File]::WriteAllText($file, $html, (New-Object Text.UTF8Encoding($false)))
  $p = Start-Process -FilePath $edge -ArgumentList @('--headless=new', '--disable-gpu', '--hide-scrollbars', "--force-device-scale-factor=$scale", "--window-size=$w,$h", '--virtual-time-budget=3000', "--screenshot=$png", "--user-data-dir=$work\profile", "file:///$($file.Replace('\','/'))") -PassThru -Wait -WindowStyle Hidden
}

foreach ($name in $designs.Keys) {
  $html = "<!doctype html><html><head><meta charset='utf-8'><style>$fonts</style></head><body>$($designs[$name])</body></html>"
  Shot $html (Join-Path $root "banners\$name.png") 1128 191 1
  Shot $html (Join-Path $root "banners\$name@2x.png") 1128 191 2
  "built $name"
}

# LinkedIn company page mock-ups (desktop), banner shown at LinkedIn's on-screen size with the overlapping logo
$logo = "file:///$assets/favicon/apple-touch-icon.png"
$i = 0
foreach ($name in $designs.Keys) {
  $i++
  $banner = "file:///" + (Join-Path $root "banners\$name@2x.png").Replace('\', '/')
  $mock = @"
<!doctype html><html><head><meta charset='utf-8'><style>
*{margin:0;padding:0;box-sizing:border-box} html,body{width:1100px;height:590px;background:#f4f2ee;font-family:'Segoe UI',Arial,sans-serif;overflow:hidden}
.card{position:absolute;left:24px;top:24px;width:1006px;background:#fff;border:1px solid #e0dfdc;border-radius:10px;overflow:hidden}
.banner{display:block;width:1006px;height:170px;object-fit:cover}
.logo{position:absolute;left:30px;top:90px;width:160px;height:160px;border:4px solid #fff;background:#fff}
.logo img{display:block;width:100%;height:100%}
.body{padding:96px 30px 22px}
.name{font-size:28px;font-weight:600;color:#191919}
.tag{margin-top:6px;font-size:18px;color:#191919}
.meta{margin-top:8px;font-size:15px;color:#666}
.btns{display:flex;gap:10px;margin-top:20px}
.btn{height:40px;padding:0 22px;border-radius:20px;border:1px solid #0a66c2;color:#0a66c2;font-size:17px;font-weight:600;display:flex;align-items:center}
.btn.p{background:#0a66c2;color:#fff}
.tabs{display:flex;gap:40px;padding:16px 30px;border-top:1px solid #eee;font-size:17px;color:#666}
.tabs b{color:#1d6b3a;font-weight:600}
.label{position:absolute;left:24px;top:556px;font-size:14px;color:#555}
</style></head><body>
<div class="card">
  <img class="banner" src="$banner">
  <div class="logo"><img src="$logo"></div>
  <div class="body">
    <div class="name">Hedley Ventures</div>
    <div class="tag">Providing ambitious growth-stage companies with fundraising expertise and CFO-level financial leadership</div>
    <div class="meta">Financial Services &middot; 2-10 employees</div>
    <div class="btns"><div class="btn p">+ Follow</div><div class="btn">Message</div><div class="btn">Visit website</div></div>
  </div>
  <div class="tabs"><b>Home</b><span>About</span><span>Posts</span><span>Jobs</span><span>People</span></div>
</div>
<div class="label">Option $i (mock-up; LinkedIn's logo position approximated from your page screenshot)</div>
</body></html>
"@
  Shot $mock (Join-Path $root "mockups\$name-linkedin-mockup.png") 1100 590 1
  "mock-up $name"
}
