# 📖 Guía de Pruebas - dLocal Go

## 🎯 Método 1: Usar la página HTML (MÁS FÁCIL)

### Paso 1: Configurar variables de entorno
Crea o edita el archivo `.env.local` en la raíz del proyecto:

```env
DLOCAL_API_KEY=tu_api_key_desde_el_dashboard_dlocal
DLOCAL_SECRET_KEY=tu_secret_key_desde_el_dashboard_dlocal
DLOCAL_BASE_URL=https://api-sbx.dlocalgo.com
DLOCAL_WEBHOOK_URL=https://tu-dominio.com/api/payments/webhook-dlocal
DLOCAL_RETURN_URL=https://tu-dominio.com/payments/return
USD_EXCHANGE_RATE=1000
```

### Paso 2: Iniciar el servidor
Abre una terminal en la raíz del proyecto y ejecuta:

```bash
npm run dev
```

Deberías ver algo como:
```
✓ Ready in 2.5s
○ Local: http://localhost:9999
```

### Paso 3: Abrir la página de prueba
1. Abre tu navegador (Chrome, Firefox, etc.)
2. Abre el archivo `test-dlocal.html` que está en la raíz del proyecto
   - Puedes hacer doble clic en el archivo, o
   - Arrastrarlo al navegador, o
   - Escribir en la barra de direcciones: `file:///ruta/completa/a/test-dlocal.html`

### Paso 4: Probar
1. En la página, completa el formulario (o déjalo con valores por defecto)
2. Haz clic en "Crear Pago"
3. Si todo está bien, verás una URL de pago que puedes abrir

---

## 🎯 Método 2: Usar el script de Node.js

### Paso 1 y 2: Igual que el Método 1

### Paso 3: Ejecutar el script
En una nueva terminal (mientras el servidor sigue corriendo):

```bash
node test-dlocal-payment.js
```

Verás el resultado en la terminal.

---

## 🎯 Método 3: Usar Postman (para usuarios avanzados)

### Paso 1 y 2: Igual que el Método 1

### Paso 3: Configurar Postman
1. Abre Postman
2. Crea una nueva petición POST
3. URL: `http://localhost:9999/api/payments/create-dlocal`
4. Headers:
   - `Content-Type: application/json`
5. Body (raw JSON):
```json
{
  "userId": "test-user-123",
  "productId": "analysis_1",
  "currency": "ARS"
}
```
6. Haz clic en "Send"

---

## 🎯 Método 4: Desde la consola del navegador

### Paso 1 y 2: Igual que el Método 1

### Paso 3: Abrir la consola
1. Abre tu navegador en cualquier página
2. Presiona F12 (o clic derecho > Inspeccionar)
3. Ve a la pestaña "Console"
4. Pega este código y presiona Enter:

```javascript
fetch('http://localhost:9999/api/payments/create-dlocal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'test-user-' + Date.now(),
    productId: 'analysis_1',
    currency: 'ARS'
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Respuesta:', data);
  if (data.checkout_url) {
    console.log('🔗 URL de pago:', data.checkout_url);
    window.open(data.checkout_url);
  }
})
.catch(err => console.error('❌ Error:', err));
```

---

## ✅ ¿Qué deberías ver si funciona?

Si todo está bien, deberías recibir una respuesta como esta:

```json
{
  "id": "order_1234567890_abc123",
  "checkout_url": "https://checkout.dlocalgo.com/...",
  "status": "PENDING"
}
```

Luego puedes abrir la `checkout_url` en tu navegador para completar el pago de prueba.

---

## ❌ Si hay errores

### Error: "Cannot connect"
- Verifica que el servidor esté corriendo (`npm run dev`)
- Verifica que el puerto sea 9999

### Error: "DLOCAL_API_KEY no configurado"
- Verifica que el archivo `.env.local` exista
- Verifica que las variables estén escritas correctamente
- **Reinicia el servidor** después de cambiar `.env.local`

### Error: "401 Unauthorized" o "403 Forbidden"
- Verifica que las API keys sean correctas
- Verifica que estés usando el entorno correcto (sandbox vs live)

### Error: "Error creando pago dLocal: 400"
- Revisa la consola del servidor para ver el error completo
- Puede que la estructura del body necesite ajustes según la documentación oficial

---

## 🔍 Ver logs del servidor

Mientras pruebas, observa la terminal donde corre `npm run dev`. Ahí verás:
- Las peticiones que llegan
- Los errores (si los hay)
- Las respuestas de dLocal Go

---

## 📝 Notas importantes

1. **Sandbox vs Live**: Por defecto está configurado para sandbox (`api-sbx.dlocalgo.com`). Para producción, cambia a `api.dlocalgo.com`

2. **Tarjetas de prueba**: 
   - Aprobada: `4111 1111 1111 1111`
   - Rechazada: `5555 5555 5555 4444`

3. **Variables de entorno**: Los cambios en `.env.local` requieren reiniciar el servidor

---

¿Necesitas ayuda? Revisa los logs del servidor y comparte el error específico.


