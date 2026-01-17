# Script para iniciar ngrok y obtener la URL del túnel
$ngrokPath = "C:\Users\Adrian\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"

Write-Host "Iniciando ngrok en el puerto 9999..."
Write-Host "La URL del túnel aparecerá abajo. Copiala y pásala para actualizar el .env.local"
Write-Host ""
Write-Host "Presiona Ctrl+C para detener ngrok cuando termines"
Write-Host ""

& $ngrokPath http 9999

