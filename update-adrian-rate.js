// Script para actualizar la tarifa de Adrian Bengolea a 50 ARS
// Ejecutar con: node update-adrian-rate.js

const https = require('http');

const data = JSON.stringify({
  coachName: 'Adrian Bengolea',
  newRate: 50
});

const options = {
  hostname: 'localhost',
  port: 9999,
  path: '/api/admin/update-coach-rate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(responseData);
      if (result.success) {
        console.log('✅ Tarifa actualizada exitosamente!');
        console.log(`   Entrenador: ${result.coachName}`);
        console.log(`   Tarifa anterior: $${result.oldRate || 'No configurada'} ARS`);
        console.log(`   Nueva tarifa: $${result.newRate} ARS`);
        console.log(`   Comisión de plataforma (30%): $${result.platformFee} ARS`);
        console.log(`   Total a pagar: $${result.totalAmount} ARS`);
      } else {
        console.log('❌ Error:', result.error || 'Error desconocido');
      }
    } catch (e) {
      console.log('📋 Respuesta:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error de conexión:', error.message);
  console.log('💡 Asegúrate de que el servidor esté corriendo en http://localhost:9999');
});

req.write(data);
req.end();


