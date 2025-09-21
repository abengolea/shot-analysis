# **App Name**: ShotVision AI

## Core Features:

- Video Upload and Management: Allow users to upload videos of basketball shots from their mobile device or other sources, such as unlisted YouTube links. The system will support slow-motion videos for detailed analysis.
- AI-Powered Frame Analysis: Automatically decompose the video into keyframes representing different phases of the shot. Detect common errors such as misaligned feet or incorrect elbow position.
- Personalized AI Recommendations: Provide personalized feedback based on the shooter's age and skill level, offering tailored drills and exercises to correct weaknesses.
- Progress Tracking and History: Display progress with visual charts. Keep a shot history, before and after adjustments, with comments and ratings by the coach.
- Community Sharing and Feedback: Enable a private comment area between the coach and the player, plus options to share videos and analysis among coaches in the academy.
- Automated Video Classification: Categorize videos by player, date, and shot type (free throw, three-pointer, etc.).
- Content Moderation: AI tool monitors uploads for harmful content

## Capture Guidelines (product constraint)
- Preferred angle: Back (behind the player) to see trajectory and rim entry.
- Durations: 40s for Back; 30s for Front and Side angles.
- The AI extracts keyframes equally from all provided angles.

## Payments / Monetización (Argentina primero)

- Moneda principal: ARS; USD solo referencia.
- Productos (Argentina):
  - analysis_1: ARS 5000
  - pack_3: ARS 13500
  - pack_10: ARS 40000
  - history_plus_annual: ARS 12000
- Límite: 2 análisis gratis por año por jugador con 6 meses de separación entre cada uno (se consume antes que créditos).
- Créditos: se acreditan por pagos aprobados; consumo al iniciar análisis si ya se usaron los 2 gratis.
- Retención: 24 meses por defecto. History+ mantiene todo el historial activo mientras dure la suscripción.
- Mercado Pago: Checkout Pro (one-shot) y webhook; suscripción anual para History+ (preapproval, a definir en próxima etapa).
- Endpoints:
  - POST /api/payments/create-preference { userId, productId }
  - POST /api/payments/webhook (notificación MP)
  - GET  /api/wallet?userId=...

## Style Guidelines:

- Primary color: Strong orange (#FF8C00) to evoke the energy and focus of basketball.
- Background color: Soft off-white (#FAF9F6) provides a clean and neutral backdrop.
- Accent color: Complementary blue (#4682B4) to highlight key interactive elements.
- Body font: 'PT Sans', a humanist sans-serif, to be used for text. Headline Font: 'Space Grotesk', a strong and impactful sans-serif.
- Use crisp, modern icons to represent different aspects of basketball shooting, such as angles, trajectory, and player positions.
- Employ a structured, card-based layout to present video analysis, recommendations, and progress tracking in an organized manner.
- Use subtle transitions and feedback animations to enhance user interaction and provide a sense of progress and achievement.

## Flujo IA local (v1)

1) Requisitos y entorno (Python)
- Python 3.10+ instalado.
- Crear y activar venv en `ml/` y luego instalar dependencias:

```
python -m venv .venv
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
```

2) Extracción de keypoints (2D)
- Desde `ml/`, ejecutar:

```
python extract_keypoints.py --video_path "C:/ruta/video.mp4" --output_path "C:/ruta/salida.json"
```

- Salida: JSON con `frames` y 33 puntos por frame (x,y,v normalizados a [0,1]).

3) Etiquetado mínimo (admin)
- Iniciar la app (npm run dev).
- Ir a `/admin/labeling`.
- Subir el JSON de keypoints, marcar etiquetas MVP (p.ej. baja_transferencia, muneca_adelantada) y ajustar métricas (ITE, delay_ms).
- Exportar `.labeled.json` para el dataset de entrenamiento.

4) Dataset y entrenamiento TCN
- Estructura sugerida:
```
ml_data/
  train/
    intento_0001.labeled.json
  val/
    intento_0101.labeled.json
```
- Entrenar baseline TCN:
```
python train_tcn.py --data_dir "C:/ruta/ml_data" --max_epochs 20 --batch_size 16
```
- El checkpoint se guarda en `lightning_logs/.../checkpoints/`. Usar esa ruta para exportar.

5) Export ONNX
```
python export_onnx.py --checkpoint "C:/ruta/lightning_logs/.../checkpoints/epoch=..ckpt" --output "onnx_models/tcn_baseline.onnx"
```

6) Serving en Next (endpoint `/api/analyze`)
- Configurar variable de entorno (opcional; si no está, se usa heurística):
```
TCN_ONNX_PATH=C:\ruta\onnx_models\tcn_baseline.onnx
```
- Reiniciar la app. El endpoint `/api/analyze` aceptará `{ frames: [...] }` y devolverá diagnósticos + métricas.

7) Pruebas desde la UI
- Admin:
  - `/admin/upload-analyze`: subir JSON y ver resultado del endpoint.
  - `/admin/labeling`: etiquetar y exportar dataset.
- Pantalla de análisis (`analysis-view`): panel “Análisis rápido desde JSON” para probar `/api/analyze` sin salir del flujo.

Notas
- v1 usa 2D (MediaPipe). 3D (VideoPose3D) es opcional y se evaluará después.
- El endpoint usa `onnxruntime-node` si `TCN_ONNX_PATH` está presente; de lo contrario aplica una heurística simple (ITE aproximado).
- Métricas MVP: ITE (0–100) y delays ms; etiquetas MVP: baja transferencia, muñeca adelantada, pickup inconsistente, brazo no alineado.

## Dataset v1 (creación rápida)

1) Extraer keypoints por carpeta
```
python ml/batch_extract.py --videos_dir "C:/videos" --output_dir "C:/keypoints_json" --workers 4
```

2) Recortar ventanas por release (opcional si ya lo hacés en admin)
```
python ml/prepare_windows.py --input_json "C:/keypoints_json/clip_0001.json" \
  --output_json "C:/ml_data/train/clip_0001.window.json" \
  --release_time_sec 3.25 --pre_ms 500 --post_ms 200
```

3) Etiquetado en admin
- Abrir `/admin/labeling`, subir JSON completo, ingresar `release` y ventana, marcar etiquetas y métricas, y exportar `.labeled.json` directo a `ml_data/train` o `ml_data/val`.

4) Entrenar y exportar ONNX (ver sección Flujo IA local)
- Entrenar `train_tcn.py` y exportar con `export_onnx.py`.
- Setear `TCN_ONNX_PATH` y probar `/api/analyze` desde admin o `analysis-view`.