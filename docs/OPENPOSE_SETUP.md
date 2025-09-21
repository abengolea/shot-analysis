# 🏀 Configuración de OpenPose para Análisis de Baloncesto

## 📋 Descripción

Este documento explica cómo configurar OpenPose para análisis técnico preciso de lanzamientos de baloncesto. OpenPose permite medir los 22 parámetros técnicos específicos del baloncesto.

## 🎯 Parámetros Técnicos Medidos

### 🏃 PREPARACIÓN (6 parámetros)
- ✅ **Alineación de pies** - Ángulo de los pies respecto al aro
- ✅ **Alineación del cuerpo** - Alineación de hombros, caderas y pies
- ✅ **Muñeca cargada** - Flexión de muñeca hacia atrás
- ✅ **Flexión de rodillas** - Ángulo de flexión (objetivo: 45°-70°)
- ✅ **Hombros relajados** - Posición y tensión de hombros
- ✅ **Enfoque visual** - Dirección de la mirada

### ⬆️ ASCENSO (6 parámetros)
- ✅ **Posición mano no dominante** - Acompañamiento sin empujar
- ✅ **Codos cerca del cuerpo** - Distancia codos-cuerpo
- ✅ **Subida recta del balón** - Trayectoria vertical
- ✅ **Trayectoria hasta set point** - Continuidad del movimiento
- ✅ **Set point** - Altura y posición del balón
- ✅ **Tiempo de lanzamiento** - Timing preciso en milisegundos

### 🌊 FLUIDEZ (2 parámetros)
- ✅ **Tiro en un solo tiempo** - Continuidad del gesto
- ✅ **Sincronía piernas** - Coordinación con extensión (~70-80%)

### 🎯 LIBERACIÓN (4 parámetros)
- ✅ **Mano no dominante en liberación** - Timing de liberación
- ✅ **Extensión completa del brazo** - Follow-through completo
- ✅ **Giro de la pelota (backspin)** - Rotación hacia atrás
- ✅ **Ángulo de salida** - Ángulo óptimo (45°-52°)

### 📈 SEGUIMIENTO (4 parámetros)
- ✅ **Mantenimiento del equilibrio** - Estabilidad post-tiro
- ✅ **Equilibrio en aterrizaje** - Posición de aterrizaje
- ✅ **Duración del follow-through** - Tiempo de seguimiento
- ✅ **Consistencia repetitiva** - Reproducibilidad del gesto

## 🚀 Instalación Rápida

### Opción 1: Script Automático
```bash
# Ejecutar script de instalación
node scripts/install-openpose.js
```

### Opción 2: Instalación Manual

#### Windows
1. Instalar dependencias:
   ```powershell
   # Con Chocolatey
   choco install cmake git visualstudio2022buildtools -y
   ```

2. Clonar OpenPose:
   ```bash
   git clone https://github.com/CMU-Perceptual-Computing-Lab/openpose.git
   cd openpose
   ```

3. Compilar:
   ```bash
   mkdir build
   cd build
   cmake -DCMAKE_BUILD_TYPE=Release -DGPU_MODE=CPU_ONLY ..
   cmake --build . --config Release
   ```

#### macOS
1. Instalar dependencias:
   ```bash
   brew install cmake git opencv
   ```

2. Compilar OpenPose (mismo proceso que Windows)

#### Linux (Ubuntu/Debian)
1. Instalar dependencias:
   ```bash
   sudo apt update
   sudo apt install cmake git libopencv-dev build-essential
   ```

2. Compilar OpenPose (mismo proceso que Windows)

## 🔧 Configuración

### Variables de Entorno
```bash
# Ruta a OpenPose (ajustar según instalación)
OPENPOSE_PATH=/path/to/openpose/build/examples/openpose
OPENPOSE_MODELS_PATH=/path/to/openpose/models

# Configuración de GPU (opcional)
CUDA_VISIBLE_DEVICES=0
```

### Configuración de Rendimiento

#### Solo CPU (Recomendado para desarrollo)
```bash
cmake -DGPU_MODE=CPU_ONLY -DCMAKE_BUILD_TYPE=Release ..
```

#### Con GPU NVIDIA (Mejor rendimiento)
```bash
# Requiere CUDA toolkit y cuDNN
cmake -DGPU_MODE=CUDA -DUSE_CUDNN=ON -DCMAKE_BUILD_TYPE=Release ..
```

## 🧪 Pruebas

### 1. Probar Instalación
```bash
python test-openpose.py
```

### 2. Probar con Video
```bash
# Usar la página de prueba
http://localhost:9999/test-pose-analysis
```

### 3. Verificar Métricas
- Sube un video de lanzamiento
- Verifica que se detecten los 22 parámetros
- Compara con análisis manual

## 📊 Interpretación de Resultados

### Puntuación General
- **90-100**: Excelente técnica
- **80-89**: Buena técnica con mejoras menores
- **70-79**: Técnica aceptable con áreas de mejora
- **60-69**: Técnica que necesita trabajo
- **<60**: Técnica que requiere corrección significativa

### Métricas Críticas
1. **Flexión de rodillas**: 45°-70° (óptimo)
2. **Ángulo de salida**: 45°-52° (óptimo)
3. **Tiro continuo**: Sin pausas en el set point
4. **Follow-through**: Extensión completa del brazo

## 🔧 Solución de Problemas

### Error: "OpenPose not found"
```bash
# Verificar instalación
which openpose
# o en Windows
where OpenPoseDemo.exe
```

### Error: "CUDA not available"
```bash
# Usar solo CPU
cmake -DGPU_MODE=CPU_ONLY ..
```

### Error: "Models not found"
```bash
# Descargar modelos
cd openpose
bash models/getModels.sh
```

### Rendimiento Lento
1. Usar GPU si está disponible
2. Reducir resolución del video
3. Procesar menos keyframes
4. Usar modelos más ligeros

## 📈 Optimización

### Para Producción
1. **Pre-procesar videos**: Reducir resolución a 720p
2. **Usar GPU**: Configurar CUDA para mejor rendimiento
3. **Cache de modelos**: Cargar modelos una sola vez
4. **Batch processing**: Procesar múltiples videos

### Para Desarrollo
1. **Usar CPU**: Más fácil de configurar
2. **Videos pequeños**: <30 segundos para pruebas rápidas
3. **Debug mode**: Habilitar logs detallados

## 🔗 Recursos Adicionales

- [Documentación oficial de OpenPose](https://github.com/CMU-Perceptual-Computing-Lab/openpose)
- [API de OpenPose](https://github.com/CMU-Perceptual-Computing-Lab/openpose/blob/master/doc/00_index.md)
- [Modelos de OpenPose](https://github.com/CMU-Perceptual-Computing-Lab/openpose/blob/master/doc/02_output.md)

## 💡 Próximos Pasos

1. **Validar precisión**: Comparar con análisis manual de entrenadores
2. **Optimizar rendimiento**: Configurar para procesamiento en tiempo real
3. **Integrar con app**: Conectar con el flujo principal de análisis
4. **Entrenar modelos**: Específicos para baloncesto si es necesario

---

**¡Con OpenPose configurado, tu aplicación puede realizar análisis técnico preciso de los 22 parámetros del lanzamiento de baloncesto!** 🏀
