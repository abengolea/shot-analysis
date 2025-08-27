# 🔥 Configuración de Firebase para Shot Analysis App

## 📋 Pasos para Configurar Firebase

### 1. Crear el archivo de variables de entorno

Copia el archivo `env.example` y renómbralo a `.env.local`:

```bash
cp env.example .env.local
```

### 2. Obtener las credenciales de Firebase Admin SDK

1. Ve a la [Consola de Firebase](https://console.firebase.google.com/)
2. Selecciona tu proyecto `shotanalisys`
3. Ve a **Configuración del proyecto** (⚙️) > **Cuentas de servicio**
4. Haz clic en **Generar nueva clave privada**
5. Descarga el archivo JSON
6. Copia los valores al archivo `.env.local`:

```env
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@shotanalisys.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_CLAVE_PRIVADA_AQUI\n-----END PRIVATE KEY-----\n"
```

### 3. Habilitar servicios en Firebase

#### Firestore Database
1. Ve a **Firestore Database** en la consola
2. Haz clic en **Crear base de datos**
3. Selecciona **Modo de prueba** (para desarrollo)
4. Elige la ubicación más cercana a tus usuarios

#### Storage
1. Ve a **Storage** en la consola
2. Haz clic en **Comenzar**
3. Selecciona **Modo de prueba** (para desarrollo)
4. Elige la ubicación más cercana a tus usuarios

#### Authentication
1. Ve a **Authentication** en la consola
2. Haz clic en **Comenzar**
3. En **Sign-in method**, habilita:
   - **Email/Password**
   - **Google** (opcional)

### 4. Desplegar las reglas de seguridad

```bash
# Instalar Firebase CLI globalmente (si no lo tienes)
npm install -g firebase-tools

# Iniciar sesión en Firebase
firebase login

# Desplegar reglas de Firestore
firebase deploy --only firestore:rules

# Desplegar reglas de Storage
firebase deploy --only storage

# Desplegar índices de Firestore
firebase deploy --only firestore:indexes
```

### 5. Probar con emuladores locales (opcional)

```bash
# Iniciar emuladores
firebase emulators:start

# Los emuladores estarán disponibles en:
# - Auth: http://localhost:9099
# - Firestore: http://localhost:8080
# - Storage: http://localhost:9199
# - UI: http://localhost:4000
```

## 🚀 Probar la aplicación

1. **Instalar dependencias:**
```bash
npm install
```

2. **Iniciar en modo desarrollo:**
```bash
npm run dev
```

3. **La aplicación estará disponible en:** http://localhost:9002

## 📁 Estructura de la base de datos

### Colecciones principales:

- **`users`** - Perfiles de usuarios
- **`coaches`** - Perfiles de entrenadores
- **`players`** - Perfiles de jugadores
- **`shotAnalysis`** - Análisis de tiros
- **`drills`** - Ejercicios personalizados
- **`playerProgress`** - Progreso del jugador

### Estructura de Storage:

- **`shot-videos/{userId}/{videoId}`** - Videos de análisis
- **`profile-images/{userId}/{imageId}`** - Imágenes de perfil
- **`analysis-docs/{userId}/{docId}`** - Documentos de análisis
- **`training-materials/{userId}/{materialId}`** - Materiales de entrenamiento

## 🔒 Reglas de seguridad

Las reglas están configuradas para:
- Solo usuarios autenticados pueden acceder
- Los usuarios solo pueden modificar sus propios datos
- Los coaches pueden ver datos de sus jugadores
- Protección contra acceso no autorizado

## 🆘 Solución de problemas

### Error: "Firebase Admin SDK not configured"
- Verifica que las variables de entorno estén correctamente configuradas
- Asegúrate de que el archivo `.env.local` existe

### Error: "Permission denied"
- Verifica que las reglas de seguridad estén desplegadas
- Asegúrate de que el usuario esté autenticado

### Error: "Storage bucket not found"
- Verifica que el Storage esté habilitado en Firebase
- Confirma que el nombre del bucket sea correcto

## 📞 Soporte

Si tienes problemas:
1. Revisa la consola del navegador para errores
2. Verifica la consola de Firebase para logs
3. Asegúrate de que todos los servicios estén habilitados

¡Tu aplicación debería estar funcionando con Firebase ahora! 🎉
