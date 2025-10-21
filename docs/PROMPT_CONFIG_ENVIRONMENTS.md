# 🔧 Configuración de Prompts IA - Ambientes

## 📍 ¿Dónde se guardan los cambios?

Los cambios de prompts se guardan en **Firebase Firestore**:

```
Firestore → config/
  ├── prompts_tres
  ├── prompts_media
  └── prompts_libre
```

## 🏗️ Opciones de Arquitectura

### Opción 1: Un Solo Proyecto Firebase (Por Defecto)

**Configuración:**
```bash
# .env.local y producción usan el mismo proyecto
NEXT_PUBLIC_FIREBASE_PROJECT_ID=shot-analysis
```

**Comportamiento:**
- ✅ Cambios en local → Se guardan en Firestore
- ✅ Cambios visibles en producción INMEDIATAMENTE
- ⚠️ **Riesgo:** Cambios experimentales afectan usuarios reales

**Usar cuando:**
- Proyecto pequeño
- Equipo chico
- No hay problema con cambios directos en producción

### Opción 2: Dos Proyectos Firebase Separados (Recomendado)

**Configuración:**
```bash
# .env.local (desarrollo)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=shot-analysis-dev
NEXT_PUBLIC_FIREBASE_API_KEY=...dev-key...

# .env.production (producción)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=shot-analysis-prod
NEXT_PUBLIC_FIREBASE_API_KEY=...prod-key...
```

**Comportamiento:**
- ✅ Cambios en local → Solo en Firestore DEV
- ✅ Producción no se afecta
- ✅ Puedes probar sin riesgos
- ❌ Debes copiar configs manualmente a producción

**Usar cuando:**
- Proyecto en producción con usuarios reales
- Necesitas probar cambios antes de publicar
- Equipo grande

### Opción 3: Un Proyecto con Separación por Prefijo (Híbrido)

**Configuración:**
```bash
# .env.local
NEXT_PUBLIC_USE_ENV_PREFIX=true
NEXT_PUBLIC_FIREBASE_PROJECT_ID=shot-analysis

# .env.production
NEXT_PUBLIC_USE_ENV_PREFIX=true
NEXT_PUBLIC_FIREBASE_PROJECT_ID=shot-analysis
```

**Comportamiento:**
- ✅ Un solo proyecto Firebase
- ✅ Configs separadas por prefijo:
  - Desarrollo: `dev_prompts_tres`, `dev_prompts_media`, `dev_prompts_libre`
  - Producción: `prod_prompts_tres`, `prod_prompts_media`, `prod_prompts_libre`
- ✅ No se mezclan dev y prod
- ❌ Debes copiar configs manualmente

**Usar cuando:**
- Quieres separación lógica
- No quieres pagar dos proyectos Firebase
- Equipo mediano

## 🚀 Flujo de Trabajo Recomendado

### Desarrollo Local:

1. **Haces cambios en `/admin/prompts`**
   ```
   Editas: Sección "Fluidez" para tiros de tres
   ```

2. **Guardas → Firebase**
   ```
   Se guarda en: config/dev_prompts_tres (con prefijo)
   O en: config/prompts_tres (sin prefijo)
   ```

3. **Pruebas locales**
   ```
   Subes un video de prueba
   IA usa el prompt con tus cambios
   Verificas que funcione bien
   ```

### Promoción a Producción:

#### Con proyectos separados:
```bash
# 1. Exportar config de dev
firebase firestore:export gs://shot-analysis-dev/backup

# 2. Copiar a prod (manual en Firebase Console)
# 3. O usar script de migración
```

#### Con prefijos:
```bash
# Script para copiar dev → prod
# Implementar en Firebase Functions o Cloud Run
```

## 📊 Comparación

| Característica | Un Proyecto | Dos Proyectos | Con Prefijos |
|----------------|-------------|---------------|--------------|
| Costo | $ | $$ | $ |
| Configuración | Simple | Compleja | Media |
| Seguridad | ⚠️ Baja | ✅ Alta | ✅ Media |
| Velocidad Deploy | ⚡ Inmediata | 🐢 Manual | 🐢 Manual |
| Recomendado para | Proyectos pequeños | Producción seria | Startups |

## ⚙️ Configuración Actual

Para verificar tu configuración actual:

```bash
# Ver variables de entorno
echo $NEXT_PUBLIC_FIREBASE_PROJECT_ID
echo $NEXT_PUBLIC_USE_ENV_PREFIX

# O revisar en el código
cat .env.local
```

## 🔄 Cambiar de Arquitectura

### De un proyecto a prefijos:

1. Agregar variable de entorno:
   ```bash
   NEXT_PUBLIC_USE_ENV_PREFIX=true
   ```

2. Reiniciar servidor:
   ```bash
   npm run dev
   ```

3. Los nuevos cambios usarán prefijos automáticamente

### Migrar configs existentes:

```javascript
// Script para copiar prompts_tres → dev_prompts_tres
// Ejecutar en Firebase Console o Functions
```

## ⚠️ Advertencias Importantes

1. **Sin prefijos + Un proyecto:**
   - 🚨 Cambios en local = cambios en producción
   - Usa solo para proyectos en desarrollo

2. **Con dos proyectos:**
   - 💰 Costo doble de Firebase
   - 📋 Mantener dos bases de datos

3. **Con prefijos:**
   - 🔄 Debes copiar configs manualmente a producción
   - 📝 Documenta qué configs están en cada ambiente

## 📚 Recursos

- [Firebase Multi-Environment Setup](https://firebase.google.com/docs/projects/multiprojects)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)

## 🆘 Preguntas Frecuentes

**Q: ¿Los cambios en local afectan producción?**
A: Solo si usas el mismo proyecto sin prefijos.

**Q: ¿Cómo copio configs de dev a prod?**
A: Manualmente en Firebase Console o con un script.

**Q: ¿Puedo deshacer un cambio?**
A: No hay versionado automático. Considera guardar backups antes de cambios grandes.

**Q: ¿Cuánto cuesta tener dos proyectos?**
A: Depende del uso. Firebase tiene plan gratuito generoso.

---

**Última actualización:** 2025-10-14
**Versión del sistema:** 1.0

