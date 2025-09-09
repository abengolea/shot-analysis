# ml/ (Entrenamiento y extracción offline)

Este directorio contiene el pipeline offline/server para:
- Extracción de keypoints 2D (MediaPipe Pose) desde videos.
- Entrenamiento de un modelo temporal baseline (TCN) para diagnósticos y métricas.
- Exportación a ONNX para servir en producción (Node/Cloud Run/Next API).

## Requisitos

Python 3.10+ recomendado. Instalar dependencias:

```
python -m venv .venv
# Windows PowerShell
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
```

## Extracción de keypoints (2D)

Ejemplo de uso:

```
python extract_keypoints.py --video_path "C:/ruta/a/video.mp4" --output_path "C:/ruta/a/salida.json" --stride 1
```

- Guarda un JSON con metadatos (fps, ancho, alto) y keypoints normalizados a [0,1] (x,y) por frame.
- Usa MediaPipe Pose (model_complexity=1, smoothing activado).

Formato de salida (resumen):

```
{
  "version": 1,
  "source_video": "...",
  "width": 1920,
  "height": 1080,
  "fps": 30.0,
  "frames": [
    {
      "index": 0,
      "time_sec": 0.0,
      "keypoints": [
        {"name": "nose", "x": 0.51, "y": 0.22, "v": 0.99},
        "... 33 puntos ..."
      ]
    }
  ]
}
```

## Entrenamiento (baseline TCN)

Asume un dataset con ventanas ya recortadas alrededor del release y anotadas con:
- labels: multi-etiqueta (por ejemplo, ["baja_transferencia", "muneca_adelantada"]).
- targets: métricas numéricas (por ejemplo, ite, delays_ms).

Estructura de archivos (sugerida):

```
ml_data/
  train/
    intento_0001.json
  val/
    intento_0101.json
```

Entrenar:

```
python train_tcn.py --data_dir "C:/ruta/a/ml_data" --max_epochs 20 --batch_size 16
```

Exportar a ONNX:

```
python export_onnx.py --checkpoint "C:/ruta/a/checkpoints/last.ckpt" --output "onnx_models/tcn_baseline.onnx"
```

## Notas

- Para v1 trabajamos con 2D. 3D (VideoPose3D) queda como opcional.
- La normalización avanzada (centrado por pelvis/torso) se puede aplicar en `datasets.py` durante el load.
- Este directorio es independiente del frontend. El serving en Next/Node consumirá el modelo ONNX.
