/**
 * Script para probar directamente la API de dLocal Go
 * Ejecutar: node test-dlocal-direct.js
 */

const API_KEY = 'WclAEZsecYnDPUXoopdhYAabkvmUDMyX';
const SECRET_KEY = 'mNbeb6yx1M1GAuKDlkY4zOsdjBSvKvAHahM9kjCc';
const BASE_URL = 'https://api-sbx.dlocalgo.com';

async function testAuth() {
  console.log('🧪 Probando autenticación con dLocal Go...\n');
  
  // Probar diferentes formatos
  const formats = [
    {
      name: 'Bearer API_KEY:SECRET_KEY',
      header: `Bearer ${API_KEY}:${SECRET_KEY}`,
    },
    {
      name: 'Basic base64(API_KEY:SECRET_KEY)',
      header: `Basic ${Buffer.from(`${API_KEY}:${SECRET_KEY}`).toString('base64')}`,
    },
    {
      name: 'API_KEY:SECRET_KEY (sin prefijo)',
      header: `${API_KEY}:${SECRET_KEY}`,
    },
  ];

  for (const format of formats) {
    console.log(`\n📤 Probando: ${format.name}`);
    console.log(`Header: ${format.header.substring(0, 50)}...`);
    
    try {
      const response = await fetch(`${BASE_URL}/v1/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': format.header,
        },
      });

      const text = await response.text();
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        console.log('✅ ¡ÉXITO! Este formato funciona:');
        console.log(JSON.stringify(JSON.parse(text), null, 2));
        return format;
      } else {
        console.log('❌ Error:', text);
      }
    } catch (error) {
      console.log('❌ Error de conexión:', error.message);
    }
  }
  
  console.log('\n⚠️ Ningún formato funcionó. Verifica:');
  console.log('1. Que las credenciales sean correctas');
  console.log('2. Que estés usando el entorno correcto (sandbox vs producción)');
  console.log('3. Que la cuenta esté activa en dLocal Go');
  
  return null;
}

// Ejecutar prueba
testAuth().then((workingFormat) => {
  if (workingFormat) {
    console.log('\n✅ Formato que funciona:', workingFormat.name);
  }
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});


