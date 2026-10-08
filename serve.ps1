# Local preview server for the Hedley Ventures website.
# Usage (from the repository folder):  powershell -ExecutionPolicy Bypass -File serve.ps1
# Then open http://localhost:8080/ in your browser. Press Ctrl+C to stop.
# Optional: -Prefix /hedley-ventures-website/ serves the site under a sub-path, mimicking GitHub Pages.
param(
  [int]$Port = 8080,
  [string]$Root = (Join-Path $PSScriptRoot 'dist'),
  [string]$Prefix = '/'
)

$Root = (Resolve-Path $Root).Path
if (-not $Prefix.StartsWith('/')) { $Prefix = '/' + $Prefix }
if (-not $Prefix.EndsWith('/')) { $Prefix += '/' }

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json'; '.xml' = 'application/xml'; '.txt' = 'text/plain; charset=utf-8'
  '.webp' = 'image/webp'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
  '.ttf' = 'font/ttf'; '.woff' = 'font/woff'; '.woff2' = 'font/woff2'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root at http://localhost:$Port$Prefix  (Ctrl+C to stop)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
    $status = 200; $file = $null

    if ($path -eq '/' -and $Prefix -ne '/') {
      $res.StatusCode = 302; $res.RedirectLocation = $Prefix; $res.Close(); continue
    }
    if ($path.StartsWith($Prefix) -or $path + '/' -eq $Prefix) {
      $rel = $path.Substring([Math]::Min($Prefix.Length, $path.Length)).TrimStart('/')
      $candidate = Join-Path $Root ($rel -replace '/', '\')
      $full = [IO.Path]::GetFullPath($candidate)
      if ($full.StartsWith($Root)) {
        if (Test-Path $full -PathType Container) {
          # Match GitHub Pages: /about -> /about/ redirect, then serve index.html
          if (-not $path.EndsWith('/')) { $res.StatusCode = 301; $res.RedirectLocation = $path + '/'; $res.Close(); continue }
          $full = Join-Path $full 'index.html'
        }
        if (Test-Path $full -PathType Leaf) { $file = $full }
      }
    }
    if (-not $file) { $status = 404; $file = Join-Path $Root '404.html' }

    $bytes = [IO.File]::ReadAllBytes($file)
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $res.StatusCode = $status
    $res.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
    $res.Headers.Add('Cache-Control', 'no-store')
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.Close()
    Write-Host "$status $path"
  }
} finally {
  $listener.Stop()
}
