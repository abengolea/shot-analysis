# Guía de etiquetado (v1)

Objetivo: anotar de forma consistente errores técnicos y métricas para entrenar el modelo temporal.

## Taxonomía (etiquetas MVP)
- baja_transferencia (bool): la cadena piernas→tronco→brazo→muñeca no transfiere energía de forma continua hacia el release (extensión insuficiente o desfasada).
- muneca_adelantada (bool): la muñeca flexiona/rompe demasiado pronto respecto a la extensión del brazo, restando proyección.
- pickup_inconsistente (bool): la toma de pelota (pickup) es inestable (mano guía o principal fuera de posición, pérdida del eje palma‑aro).
- brazo_no_alineado (bool): codo‑muñeca‑pelota no alinean con el aro en el plano de tiro (tendencia a desalinear lateralmente).

## Métricas (regresiones)
- ite (0–100): Índice de Transferencia de Energía. 0: sin transferencia, 100: cadena fluida continua.
- delay_ms (entero): diferencia temporal entre el pico de extensión de la cadera/rodilla y el de la muñeca/codo (ms). Valores positivos grandes sugieren desincronización.

## Definiciones operativas
- Release: frame donde la pelota se despega claramente de la mano dominante.
- Ventana: [release−500 ms, release+200 ms] por defecto. Ajustar si el gesto es más lento/rápido.
- Normalización: consideramos keypoints normalizados por pelvis y escala hombros, por lo que los valores XY son relativos.

## Criterios de etiquetado
- baja_transferencia = true si:
  - Extensión de tobillo/rodilla/cadera no precede o acompaña a la elevación del brazo, o
  - No hay incremento progresivo de altura de muñeca respecto a hombros antes del release, o
  - El delay_ms > 150 ms (regla orientativa).
- muneca_adelantada = true si:
  - La muñeca flexiona claramente antes de que el codo alcance su pico de extensión.
- pickup_inconsistente = true si:
  - La transición de toma a armado muestra inestabilidad lateral/rotacional evidente, o la pelota se aleja del eje de tiro.
- brazo_no_alineado = true si:
  - El vector codo→muñeca no apunta hacia el aro durante la subida (desalineación lateral sostenida).

## Procedimiento recomendado
1) Cargar JSON keypoints completo, ingresar `release` y recortar la ventana.
2) Observar trayectoria de muñeca, codo y hombros; evaluar continuidad de extensión.
3) Marcar etiquetas (pueden ser múltiples) y fijar métricas:
   - ite guía: 30–50 si hay esfuerzo pero desfasado; 60–80 si es mayormente correcto; >85 si la cadena es muy fluida.
   - delay_ms guía: 60–120 ms típico; >150 ms = desfasado.
4) Exportar `.labeled.json`.

## Notas y ejemplos
- Diferentes ángulos: priorizar frames donde el esqueleto sea más visible. Si hay duda, marcar conservador y anotar comentario aparte (fuera de v1).
- Consistencia: ante la duda, revisar 2–3 ejemplos previos etiquetados para mantener el estándar.
