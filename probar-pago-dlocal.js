// Copia y pega esto en la consola del navegador (F12 > Console)

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
  console.log('✅ Respuesta completa:', data);
  if (data.checkout_url) {
    console.log('🔗 URL de pago:', data.checkout_url);
    console.log('💡 Abriendo URL de pago en nueva pestaña...');
    window.open(data.checkout_url, '_blank');
  } else if (data.error) {
    console.error('❌ Error:', data.error);
    if (data.missing) {
      console.error('⚠️ Variables faltantes:', data.missing);
    }
  } else {
    console.log('📋 Datos recibidos:', data);
  }
})
.catch(err => {
  console.error('❌ Error de conexión:', err);
  console.log('💡 Verifica que el servidor esté corriendo en el puerto 9999');
});


