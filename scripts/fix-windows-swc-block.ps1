# Script para agregar exclusión en Windows Defender y permitir que Next.js cargue el binario SWC
# Ejecutar como Administrador si es necesario
# Ref: https://support.microsoft.com/es-es/windows/agregar-una-exclusi%C3%B3n-o-una-excepci%C3%B3n-a-microsoft-defender-antivirus-811816c0-4dfd-af4a-47d4-7c5a4f6e7c5a

$projectPath = "C:\Users\Adrian\Desktop\shot-analysis-main"
$swcPath = "$projectPath\node_modules\@next\swc-win32-x64-msvc"

Write-Host "=== Solución para el bloqueo de SWC en Windows ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Windows está bloqueando el archivo next-swc.win32-x64-msvc.node por políticas de Control de aplicaciones."
Write-Host ""
Write-Host "PASOS MANUALES (recomendado):" -ForegroundColor Yellow
Write-Host "1. Abre 'Seguridad de Windows' (busca en el menú Inicio)"
Write-Host "2. Protección contra virus y amenazas > Configuración"
Write-Host "3. Exclusiones > Agregar o quitar exclusiones"
Write-Host "4. Agregar exclusión > Carpeta"
Write-Host "5. Selecciona esta ruta:" -ForegroundColor Green
Write-Host "   $projectPath"
Write-Host ""
Write-Host "6. Cierra cualquier terminal/IDE que tenga el proyecto abierto"
Write-Host "7. Ejecuta: npm run dev"
Write-Host ""
Write-Host "Ruta a excluir:" -ForegroundColor Gray
Write-Host $projectPath
