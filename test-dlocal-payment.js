/**
 * Script de prueba para dLocal Go
 * 
 * Para ejecutar:
 * 1. Asegúrate de tener las variables de entorno configuradas en .env.local
 * 2. Inicia el servidor: npm run dev
 * 3. Ejecuta este script: node test-dlocal-payment.js
 */

const API_URL = 'http://localhost:9999/api/payments/create-dlocal';

async function testCreatePayment() {
  console.log('🧪 Probando creación de pago con dLocal Go...\n');
  
  const testData = {
    userId: 'test-user-' + Date.now(),
    productId: 'analysis_1',
    currency: 'ARS'
  };

  console.log('📤 Enviando petición:');
  console.log('URL:', API_URL);
  console.log('Datos:', JSON.stringify(testData, null, 2));
  console.log('\n');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const data = await response.json();

    console.log('📥 Respuesta recibida:');
    console.log('Status:', response.status, response.statusText);
    console.log('Datos:', JSON.stringify(data, null, 2));
    console.log('\n');

    if (response.ok && data.checkout_url) {
      console.log('✅ ¡Éxito! Pago creado correctamente');
      console.log('🔗 URL de pago:', data.checkout_url);
      console.log('\n💡 Puedes abrir esta URL en tu navegador para completar el pago de prueba');
    } else {
      console.log('❌ Error al crear el pago');
      if (data.error) {
        console.log('Error:', data.error);
      }
    }
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    console.log('\n💡 Asegúrate de que:');
    console.log('   1. El servidor esté corriendo (npm run dev)');
    console.log('   2. El puerto sea 9999 (o ajusta la URL en este script)');
    console.log('   3. Las variables de entorno estén configuradas en .env.local');
  }
}

// Ejecutar la prueba
testCreatePayment();


