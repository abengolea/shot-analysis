# Manual simple para operador (ShotVision)

Objetivo: que cualquier persona pueda usar la herramienta sin saber de computación.

## Qué vas a hacer
1) Subir el video.
2) Obtener el análisis de IA.
3) Ver las indicaciones y ejercicios.

## Antes de empezar
- Video claro del tiro, cuerpo completo, buena luz.
- Si podés, 60 fps. Si no, 30 fps también sirve.
- Ángulo preferido: Trasero (desde atrás del jugador). Si no lo tenés, usá el Frontal.
- Duración recomendada: 40 segundos para Trasera; 30 segundos para Frontal y Laterales.

## Paso a paso (rápido)
1) Abrí la app y logeate.
2) Ir a “Subir” y cargá el video trasero (preferido). Si no tenés trasero, cargá el frontal. Opcionalmente agregá laterales.
3) Esperá a que procese. La IA extrae frames de todos los videos que subas por igual.
4) Entrá a “Análisis” y abrí el resultado.
5) Vas a ver:
   - Resumen de IA.
   - Puntos a mejorar.
   - Sugerencias y ejercicios.

Listo. Eso es todo para usar el análisis.

## Si querés etiquetar (opcional, para mejorar el sistema)
1) Menú “Admin” → “Herramienta de etiquetado”.
2) Clic en “Subir JSON” (archivo de puntos que ya genera el sistema).
3) Escribí en “Release (segundos)” el momento cuando la pelota sale de la mano.
4) Ajustá la ventana (antes/después del release). Dejalo como está si no sabés.
5) Marcá lo que veas:
   - Baja transferencia
   - Muñeca adelantada
   - Pickup inconsistente
   - Brazo no alineado
6) Ajustá ITE (0 a 100) si querés. Si no, dejalo.
7) Guardá con “Exportar etiquetado”.

Tip: Si no estás seguro, no marques. Mejor pocas etiquetas pero bien.

## Dónde ver resultados
- En “Admin → Subir JSON y analizar” podés probar un archivo rápido y ver el resultado al instante.
- En la vista de análisis del jugador, hay un panel “Análisis rápido desde JSON” para pruebas.

## Problemas comunes (y solución)
- No aparece nada: refrescá la página y verificá conexión a internet.
- “JSON inválido”: volvé a generar el archivo desde el extractor (o pedí ayuda al técnico).
- Video muy oscuro o lejos: repetí con mejor luz y encuadre más cerca.
- El aro no se ve desde atrás: acercate y asegurá encuadre donde se vea la parábola y si la pelota entra.

## Ayuda
- Guía de etiquetas: docs/labeling-guidelines.md
- Manual técnico (para el técnico): docs/training-manual.md

Fin.
