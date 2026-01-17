/**
 * Script para probar con URL de producción
 */

const API_KEY = 'WclAEZsecYnDPUXoopdhYAabkvmUDMyX';
const SECRET_KEY = 'mNbeb6yx1M1GAuKDlkY4zOsdjBSvKvAHahM9kjCc';
const BASE_URL_PROD = 'https://api.dlocalgo.com';
const BASE_URL_SBX = 'https://api-sbx.dlocalgo.com';

async function testBothEnvironments() {
  console.log('🧪 Probando ambos entornos (sandbox y producción)...\n');
  
  const environments = [
    { name: 'Sandbox', url: BASE_URL_SBX },
    { name: 'Producción', url: BASE_URL_PROD },
  ];

  for (const env of environments) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🌐 Probando: ${env.name} (${env.url})`);
    console.log('='.repeat(50));
    
    const header = `Bearer ${API_KEY}:${SECRET_KEY}`;
    
    try {
      const response = await fetch(`${env.url}/v1/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': header,
        },
      });

      const text = await response.text();
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        console.log('✅ ¡ÉXITO! Este entorno funciona:');
        console.log(JSON.stringify(JSON.parse(text), null, 2));
        return { environment: env.name, url: env.url };
      } else {
        console.log('❌ Error:', text);
      }
    } catch (error) {
      console.log('❌ Error de conexión:', error.message);
    }
  }
  
  console.log('\n⚠️ Ningún entorno funcionó.');
  console.log('\n💡 Posibles causas:');
  console.log('1. Las credenciales son incorrectas o han expirado');
  console.log('2. La cuenta necesita ser activada en dLocal Go');
  console.log('3. Las credenciales necesitan permisos específicos');
  console.log('4. Contacta con soporte de dLocal Go para verificar tu cuenta');
  
  return null;
}

testBothEnvironments().then((result) => {
  if (result) {
    console.log('\n✅ Entorno que funciona:', result);
  }
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});


