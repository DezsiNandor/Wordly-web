# WL (Word Learning) - Könnyűsúlyú Beépített PowerShell HTTP Szerver
$port = 3001
$prefix = "http://localhost:$port/"
$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host "=================================================" -ForegroundColor Cyan
    Write-Host "  WL (Word Learning) Szerver Fut!" -ForegroundColor Green
    Write-Host "  URL: $prefix" -ForegroundColor Yellow
    Write-Host "  Leallitas: Nyomj Ctrl+C billentyukombinaciot" -ForegroundColor Gray
    Write-Host "=================================================" -ForegroundColor Cyan

    # Bongeszo automatikus megnyitasa
    try { Start-Process $prefix } catch {}

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($urlPath) -or $urlPath -eq '/') {
            $urlPath = 'index.html'
        }

        # Biztonsagos eleresi ut feloldas
        $filePath = [System.IO.Path]::Combine($baseDir, $urlPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))

        if ([System.IO.File]::Exists($filePath)) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($ext) {
                '.html' { 'text/html; charset=utf-8' }
                '.htm'  { 'text/html; charset=utf-8' }
                '.js'   { 'application/javascript; charset=utf-8' }
                '.mjs'  { 'application/javascript; charset=utf-8' }
                '.css'  { 'text/css; charset=utf-8' }
                '.json' { 
                    if ($filePath.EndsWith('manifest.json')) {
                        'application/manifest+json; charset=utf-8'
                    } else {
                        'application/json; charset=utf-8'
                    }
                }
                '.webmanifest' { 'application/manifest+json; charset=utf-8' }
                '.png'  { 'image/png' }
                '.jpg'  { 'image/jpeg' }
                '.jpeg' { 'image/jpeg' }
                '.svg'  { 'image/svg+xml' }
                '.ico'  { 'image/x-icon' }
                '.xlsx' { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
                '.xls'  { 'application/vnd.ms-excel' }
                '.xml'  { 'application/xml; charset=utf-8' }
                '.txt'  { 'text/plain; charset=utf-8' }
                default { 'application/octet-stream' }
            }

            $response.ContentType = $contentType
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            
            $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $fileBytes.Length
            $response.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
        } else {
            $response.StatusCode = 404
            $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Nem Talalhato: $urlPath")
            $response.OutputStream.Write($notFoundBytes, 0, $notFoundBytes.Length)
        }

        $response.OutputStream.Close()
    }
} catch {
    Write-Host "Szerver leallt vagy hiba tortent: $_" -ForegroundColor Red
} finally {
    $listener.Stop()
    $listener.Close()
}
