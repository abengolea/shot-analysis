# Configuración de AWS Rekognition

Esta guía te ayudará a configurar AWS Rekognition para el análisis de videos de baloncesto.

## Prerrequisitos

1. Cuenta de AWS activa
2. Acceso a AWS Console
3. Permisos para crear usuarios IAM

## Paso 1: Crear Usuario IAM

1. Ve a [AWS Console > IAM](https://console.aws.amazon.com/iam/)
2. Selecciona "Users" en el menú lateral
3. Haz clic en "Create user"
4. Nombre del usuario: `shot-analysis-rekognition`
5. Selecciona "Programmatic access"

## Paso 2: Asignar Permisos

Asigna las siguientes políticas al usuario:

### Políticas de AWS Rekognition
- `AmazonRekognitionFullAccess`

### Políticas de S3
- `AmazonS3FullAccess` (o crea una política personalizada)

### Política Personalizada de S3 (Recomendada)
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::shot-analysis-videos/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::shot-analysis-videos"
        }
    ]
}
```

## Paso 3: Crear Bucket de S3

1. Ve a [AWS Console > S3](https://console.aws.amazon.com/s3/)
2. Haz clic en "Create bucket"
3. Nombre del bucket: `shot-analysis-videos` (o el que prefieras)
4. Región: `us-east-1` (recomendado para Rekognition)
5. Configuración por defecto para el resto

## Paso 4: Configurar Variables de Entorno

1. Copia `env.aws.example` a `.env.local`:
   ```bash
   cp env.aws.example .env.local
   ```

2. Edita `.env.local` con tus credenciales:
   ```env
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=shot-analysis-videos
   ```

## Paso 5: Probar la Configuración

1. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

2. Ve a `http://localhost:3000/test-aws-rekognition`

3. Sube un video de prueba y verifica que funcione

## Limitaciones de AWS Rekognition

### Lo que SÍ puede hacer:
- Detectar personas en videos
- Identificar objetos (balones, canastas)
- Detectar movimiento general
- Clasificar contenido general

### Lo que NO puede hacer:
- Análisis técnico detallado de baloncesto
- Detección de poses específicas
- Evaluación de técnica de tiro
- Análisis de ángulos corporales
- Detección de parámetros técnicos específicos

## Comparación con el Sistema Actual

| Característica | Sistema Actual (Gemini) | AWS Rekognition |
|----------------|-------------------------|-----------------|
| Análisis técnico | ✅ Detallado | ❌ Básico |
| Detección de poses | ✅ Especializada | ❌ No disponible |
| Evaluación de técnica | ✅ 22 parámetros | ❌ Limitada |
| Costo | Variable | Por minuto de video |
| Velocidad | Rápida | Lenta (async) |
| Precisión técnica | Alta | Baja |

## Recomendaciones

1. **Para pruebas básicas**: Usa AWS Rekognition
2. **Para análisis profesional**: Usa el sistema actual con Gemini
3. **Para producción**: Combina ambos sistemas según necesidad

## Solución de Problemas

### Error: "Credenciales de AWS no configuradas"
- Verifica que `.env.local` existe
- Confirma que las variables están correctamente configuradas
- Reinicia el servidor de desarrollo

### Error: "Access Denied"
- Verifica los permisos del usuario IAM
- Confirma que el bucket existe
- Verifica la región configurada

### Error: "Bucket not found"
- Crea el bucket en S3
- Verifica el nombre del bucket en `.env.local`
- Confirma que la región es correcta

## Costos Estimados

- **Rekognition Video Analysis**: ~$0.10 por minuto de video
- **S3 Storage**: ~$0.023 por GB/mes
- **S3 Requests**: ~$0.0004 por 1000 requests

Para un video de 30 segundos:
- Análisis: ~$0.05
- Storage: ~$0.001
- **Total**: ~$0.051 por video
