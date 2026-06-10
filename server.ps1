# server.ps1 - Servidor HTTP Local para Baby Dino Jump
# Sirve index.html, styles.css, game.js y la imagen del bebé en localhost:8000

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$port = 8085
$url = "http://127.0.0.1:$port/"

# Obtener MIME type según la extensión del archivo
function Get-MimeType {
    param([string]$path)
    $ext = [System.IO.Path]::GetExtension($path).ToLower()
    switch ($ext) {
        ".html" { return "text/html; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".js"   { return "application/javascript; charset=utf-8" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".png"  { return "image/png" }
        default { return "application/octet-stream" }
    }
}

# Enviar respuesta de archivo
function Send-FileResponse {
    param($response, $filePath)
    
    if (-not (Test-Path $filePath)) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("Archivo no encontrado")
        $response.StatusCode = 404
        $response.ContentType = "text/plain; charset=utf-8"
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        $response.Close()
        return
    }
    
    try {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.StatusCode = 200
        $response.ContentType = Get-MimeType $filePath
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    catch {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("Error del servidor: $_")
        $response.StatusCode = 500
        $response.ContentType = "text/plain; charset=utf-8"
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    $response.Close()
}

# Inicializar HttpListener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)

try {
    $listener.Start()
}
catch {
    Write-Error "No se pudo iniciar el servidor en el puerto $port. Asegúrate de que no esté en uso. Detalles: $_"
    exit
}

Write-Host "=================================================="
Write-Host "   SERVIDOR ACTIVO - BABY DINO JUMP"
Write-Host "=================================================="
Write-Host "Servidor corriendo en: $url"
Write-Host "Abriendo el juego en tu navegador..."
Write-Host "Presiona Ctrl+C en la terminal para detener el servidor."
Write-Host "--------------------------------------------------"

Start-Process $url

# Bucle principal de escucha de peticiones
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $path = $request.Url.LocalPath
        
        # Enrutar peticiones a archivos locales
        if ($path -eq "/") { $path = "/index.html" }
        
        # Obtener ruta de archivo absoluta segura
        $cleanPath = $path.Replace("/", [System.IO.Path]::DirectorySeparatorChar)
        if ($cleanPath.StartsWith([System.IO.Path]::DirectorySeparatorChar)) {
            $cleanPath = $cleanPath.Substring(1)
        }
        $filePath = Join-Path $PSScriptRoot $cleanPath
        
        Write-Host "$(Get-Date -Format 'HH:mm:ss') - GET $path"
        Send-FileResponse $response $filePath
    }
    catch {
        Write-Host "Error procesando petición: $_"
    }
}

$listener.Stop()
Write-Host "Servidor detenido."
