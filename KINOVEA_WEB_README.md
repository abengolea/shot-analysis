# 🎥 Kinovea Web - Sistema de Análisis Biomecánico

**Kinovea Web** es un sistema completo de análisis de video tipo "Kinovea" pero 100% web, diseñado para análisis biomecánico, deportivo y de movimiento. Combina herramientas de medición manual con análisis automático de pose usando IA.

## ✨ Características Principales

### 🎯 Herramientas de Medición
- **Regla**: Medir distancias con calibración de escala real (px ↔ cm)
- **Ángulo**: Medir ángulos entre tres puntos (ej: hombro-codo-muñeca)
- **Línea**: Dibujar líneas de referencia
- **Círculo**: Medir radios y áreas circulares
- **Rectángulo**: Medir áreas rectangulares
- **Texto**: Añadir anotaciones y comentarios
- **Grid**: Cuadrícula opcional para mejor precisión

### 🧠 Análisis con IA
- **Detección de Pose**: MediaPipe para identificar 33 keypoints del cuerpo
- **Métricas Biomecánicas**: Cálculo automático de ángulos y alineaciones
- **Evaluación de Postura**: Análisis automático de la calidad del movimiento
- **Análisis Temporal**: Seguimiento de la evolución de la postura en el tiempo

### 📊 Funcionalidades Avanzadas
- **Reproductor de Video**: Controles avanzados, timeline, bookmarks
- **Navegación Frame por Frame**: Avance/retroceso preciso
- **Vista Lado a Lado**: Comparar dos videos simultáneamente
- **Sistema de Capas**: Organizar y gestionar mediciones
- **Exportación**: PNG, JSON, y próximamente video con overlay

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js 18+ 
- npm o yarn
- Navegador moderno con soporte para WebGL

### Instalación
```bash
# Clonar el repositorio
git clone <tu-repositorio>
cd shot-analysis-main

# Instalar dependencias
npm install

# Las dependencias de Kinovea Web ya están incluidas:
# - konva & react-konva (canvas 2D)
# - @tensorflow/tfjs (IA)
# - @mediapipe/tasks-vision (detección de pose)
```

### Configuración
1. **Variables de Entorno**: Configura Firebase si lo usas
2. **Modelos de IA**: Los modelos de MediaPipe se descargan automáticamente
3. **Calibración**: Configura el factor de escala para mediciones reales

## 📖 Guía de Uso

### 1. Iniciar el Sistema
```bash
npm run dev
# Navega a http://localhost:9002/kinovea-demo
```

### 2. Cargar Video
- **Subir archivo**: Arrastra o selecciona un video desde tu dispositivo
- **Video de demo**: Usa el botón para cargar un video de ejemplo
- **Formatos soportados**: MP4, AVI, MOV, WebM

### 3. Configurar Calibración
1. Marca un segmento conocido en el video (ej: 1 metro)
2. Establece la longitud real en centímetros
3. El sistema calcula automáticamente el factor px/cm

### 4. Realizar Mediciones
1. **Selecciona herramienta**: Regla, ángulo, línea, etc.
2. **Haz clic en el canvas**: Para marcar puntos
3. **Ajusta mediciones**: Mueve puntos si es necesario
4. **Organiza en capas**: Gestiona visibilidad y bloqueo

### 5. Análisis Automático
1. **Inicia detección de pose**: El botón "Iniciar Detección"
2. **Revisa métricas**: Ángulos, alineaciones, postura
3. **Analiza evolución**: Gráficos temporales de la postura
4. **Exporta resultados**: Datos JSON para análisis posterior

## 🔧 Arquitectura Técnica

### Componentes Principales
```
src/components/
├── kinovea-web.tsx          # Componente principal
├── video-player.tsx         # Reproductor de video avanzado
├── measurement-tools.tsx    # Herramientas de medición
├── measurement-canvas.tsx   # Canvas de dibujo con Konva
├── pose-detection.tsx       # Detección de pose con MediaPipe
└── lib/
    └── measurement-utils.ts # Utilidades matemáticas
```

### Tecnologías Utilizadas
- **Frontend**: Next.js 15, React 18, TypeScript
- **Canvas**: Konva.js para gráficos 2D interactivos
- **IA**: MediaPipe Tasks para detección de pose
- **UI**: Radix UI + Tailwind CSS
- **Estado**: React hooks + Context API

### Flujo de Datos
1. **Video Input** → VideoPlayer → Timeline & Controls
2. **Canvas Interaction** → MeasurementCanvas → Konva Stage
3. **AI Processing** → PoseDetection → MediaPipe → Biomechanical Metrics
4. **Data Export** → JSON/PNG → Storage/Download

## 📐 Métricas Biomecánicas

### Ángulos Calculados
- **Hombro-Codo-Muñeca**: Ideal 80-120°
- **Cadera-Rodilla-Tobillo**: Ideal 160-180°
- **Alineación Hombro-Cadera**: Ideal < 10°
- **Alineación Codo-Rodilla**: Ideal < 20px

### Evaluación de Postura
- **Buena**: 3-4 criterios cumplidos
- **Regular**: 1-2 criterios cumplidos  
- **Mala**: 0 criterios cumplidos

### Análisis Temporal
- **Evolución de la postura**: Gráficos de barras por frame
- **Consistencia**: Desviación estándar de las métricas
- **Tendencias**: Análisis de progresión del movimiento

## 🎨 Personalización

### Temas y Estilos
- **Tailwind CSS**: Sistema de diseño consistente
- **Componentes UI**: Biblioteca de componentes reutilizables
- **Responsive**: Adaptable a diferentes tamaños de pantalla

### Configuración de Herramientas
- **Sensibilidad**: Ajustar precisión de las mediciones
- **Colores**: Personalizar colores de las herramientas
- **Atajos**: Configurar teclas de acceso rápido

## 📤 Exportación y Datos

### Formatos de Salida
- **JSON**: Todas las mediciones, métricas y metadatos
- **PNG**: Canvas con mediciones superpuestas
- **Video**: Próximamente, video con overlay de mediciones
- **PDF**: Próximamente, reportes completos

### Estructura de Datos JSON
```json
{
  "measurements": [...],
  "calibration": 10.5,
  "bookmarks": [...],
  "poseData": [...],
  "biomechanicalMetrics": [...],
  "metadata": {
    "videoSrc": "...",
    "timestamp": "...",
    "totalMeasurements": 15
  }
}
```

## 🔍 Casos de Uso

### 🏀 Deportes
- **Baloncesto**: Análisis de tiro libre, postura defensiva
- **Fútbol**: Técnica de pateo, biomecánica del golpeo
- **Atletismo**: Técnica de carrera, salto largo
- **Tenis**: Servicio, golpes de fondo

### 🏥 Rehabilitación
- **Fisioterapia**: Evaluación de rango de movimiento
- **Ortopedia**: Análisis de marcha, postura
- **Deportiva**: Recuperación post-lesión

### 🎓 Educación
- **Entrenamiento**: Análisis de técnica deportiva
- **Investigación**: Estudios biomecánicos
- **Análisis**: Comparación de movimientos

## 🚧 Limitaciones y Consideraciones

### Técnicas
- **Navegador**: Requiere soporte para WebGL y WebAssembly
- **Rendimiento**: Análisis de pose puede ser lento en dispositivos antiguos
- **Precisión**: Depende de la calidad del video y la iluminación

### Funcionales
- **Calibración**: Requiere configuración manual para mediciones reales
- **Modelos IA**: Descarga inicial de modelos puede tomar tiempo
- **Exportación**: Algunas funcionalidades están en desarrollo

## 🔮 Roadmap

### Próximas Funcionalidades
- [ ] **Exportación de Video**: Render con overlay de mediciones
- [ ] **Reportes PDF**: Generación automática de reportes
- [ ] **Comparación Avanzada**: Análisis estadístico entre videos
- [ ] **Machine Learning**: Modelos personalizados para deportes específicos
- [ ] **Colaboración**: Compartir análisis entre usuarios
- [ ] **API**: Endpoints para integración con otros sistemas

### Mejoras Técnicas
- [ ] **Web Workers**: Procesamiento en segundo plano
- [ ] **IndexedDB**: Almacenamiento local de análisis
- [ ] **PWA**: Aplicación web progresiva
- [ ] **Offline**: Funcionamiento sin conexión

## 🤝 Contribución

### Cómo Contribuir
1. **Fork** el repositorio
2. **Crea** una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. **Push** a la rama (`git push origin feature/AmazingFeature`)
5. **Abre** un Pull Request

### Áreas de Contribución
- **UI/UX**: Mejoras en la interfaz de usuario
- **Algoritmos**: Nuevas métricas biomecánicas
- **Performance**: Optimización del rendimiento
- **Testing**: Tests unitarios y de integración
- **Documentación**: Mejoras en la documentación

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🙏 Agradecimientos

- **MediaPipe**: Por los modelos de detección de pose
- **Konva.js**: Por el sistema de canvas 2D
- **Next.js**: Por el framework de React
- **Tailwind CSS**: Por el sistema de diseño
- **Comunidad**: Por el feedback y contribuciones

## 📞 Soporte

### Canales de Ayuda
- **Issues**: Reporta bugs en GitHub Issues
- **Discussions**: Preguntas y discusiones en GitHub Discussions
- **Wiki**: Documentación detallada en el Wiki del proyecto

### Recursos Adicionales
- **Documentación API**: Referencia completa de la API
- **Ejemplos**: Casos de uso y ejemplos prácticos
- **Tutoriales**: Guías paso a paso para diferentes escenarios

---

**Kinovea Web** - Transformando el análisis de video en la web 🌐✨
