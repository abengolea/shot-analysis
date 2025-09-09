# Manual de entrenamiento (v1)

Este manual explica cómo preparar datos, entrenar el modelo temporal (TCN), exportar a ONNX e integrar el modelo en la app.

## 0. Lineamientos de captura (para dataset y uso en app)
- Ángulo preferido: Trasero (desde atrás del jugador). Si no está disponible, usar Frontal.
- Duración recomendada: 40 segundos para Trasera; 30 segundos para Frontal y Laterales.
- Encuadre: cuerpo completo. Desde atrás, que se vea el aro para observar la parábola y si la pelota entra.
- Estabilidad: trípode o apoyo; evitar zoom digital y movimientos bruscos.
- Iluminación: buena luz; evitar contraluces fuertes.
- Resolución/fps: 1080p a 30 fps o más (60 fps ideal para entrenamiento).

## 1. Preparar entorno

Requisitos:
- Python 3.10 o superior
- Windows PowerShell (usado en los ejemplos)

Instalación:
```
cd ml
python -m venv .venv
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
```

## 2. Extraer keypoints desde videos

Opciones:
- Individual:
```
python extract_keypoints.py --video_path "C:\videos\clip1.mp4" --output_path "C:\keypoints_json\clip1.json"
```
- Por carpeta (batch):
```
python batch_extract.py --videos_dir "C:\videos" --output_dir "C:\keypoints_json" --workers 4
```

Salida: JSON con `frames` y 33 puntos por frame (x,y,v normalizados a [0,1]).

## 3. Crear dataset etiquetado

Opción A (recomendada): usar herramienta admin
- Iniciar app local (`npm run dev`).
- Ir a `/admin/labeling`.
- Subir JSON (completo), ingresar `release (segundos)` y ventana (pre/post ms), marcar etiquetas y métricas (ver `docs/labeling-guidelines.md`).
- Exportar `.labeled.json` y guardarlo en:
```
ml_data/
  train/
    intento_0001.labeled.json
  val/
    intento_0101.labeled.json
```

Opción B: recorte por script + etiquetado manual
- Recortar ventana por release (si ya lo conocés):
```
python prepare_windows.py --input_json "C:\keypoints_json\clip1.json" \
  --output_json "C:\ml_data\train\clip1.window.json" \
  --release_time_sec 3.25 --pre_ms 500 --post_ms 200
```
- Editar/crear etiquetas/métricas en el JSON resultante.

Sugerencia de tamaño para v1:
- 20–30 intentos etiquetados (balanceados entre clases).

## 4. Entrenamiento del modelo TCN

Ejecutar:
```
python train_tcn.py --data_dir "C:\ml_data" --max_epochs 20 --batch_size 16
```
Notas:
- El script busca `train/*.json` y `val/*.json`.
- Hiperparámetros básicos: `num_labels=4`, `num_targets=2` (coinciden con etiquetas/métricas MVP).
- Se guardarán checkpoints en `lightning_logs/.../checkpoints/`.

Consejos:
- Si tenés secuencias de distinta longitud, el `collate` ya recorta al mínimo de cada batch.
- Aumentá `max_epochs` si el dataset es ruidoso o inicial.

## 5. Exportar a ONNX

1) Identificar checkpoint (`.ckpt`).
2) Exportar:
```
python export_onnx.py --checkpoint "C:\ruta\lightning_logs\...\checkpoints\epoch=..ckpt" --output "C:\onnx_models\tcn_baseline.onnx"
```

## 6. Integración con la app (endpoint)

1) Configurar variable de entorno (opcional):
```
TCN_ONNX_PATH=C:\onnx_models\tcn_baseline.onnx
```
2) Iniciar app y probar:
- Admin → `/admin/upload-analyze` o `analysis-view` → “Análisis rápido desde JSON”.
- Enviar `{ frames: [...] }` al endpoint `/api/analyze`.

Si `TCN_ONNX_PATH` no está seteado, el endpoint usa una heurística (ITE aproximado) para responder.

## 7. Validación y métricas

Durante entrenamiento:
- Pérdidas: clasificación (BCEWithLogits) y regresión (SmoothL1).
- Métricas sugeridas: F1 por etiqueta, mAP (offline), MAE/MAPE para ite/delays.

Validación manual:
- Comparar etiquetas predichas vs. esperadas en una muestra pequeña.
- Revisar ejemplos frontera (dudas) y ajustar guía de etiquetado.

## 8. Troubleshooting

- No se instalan dependencias de MediaPipe:
  - Asegurarse de usar Python 3.10+ y `pip install -r requirements.txt` en la venv.
- ONNX no carga en Node (`onnxruntime-node`):
  - Asegurarse de que el endpoint corre en server (no en client) y que la ruta `TCN_ONNX_PATH` es válida.
- JSON inválido en admin:
  - Debe incluir `frames` y cada frame tener `index`, `time_sec` y `keypoints` (33).
- No mejora en entrenamiento:
  - Revisar calidad de etiquetas, balance de clases y longitud de ventanas; aumentar epochs.

## 9. Próximos pasos

- Recolectar más datos y balancear por ángulo y jugador.
- Probar data augmentation temporal (ruido en tiempos, pequeños shifts).
- Evaluar ST-GCN o transformer temporal si TCN queda corto.
