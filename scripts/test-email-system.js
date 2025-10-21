/**
 * Script de prueba para el sistema de emails masivos
 * 
 * Este script te permite probar las APIs de emails sin usar la interfaz web
 * 
 * USO:
 * 1. Obtén un token de autenticación desde tu navegador (inspecciona la llamada API en DevTools)
 * 2. Ejecuta: node scripts/test-email-system.js
 */

const BASE_URL = 'http://localhost:9999'; // Ajusta según tu configuración

// Reemplaza esto con un token válido de admin
const AUTH_TOKEN = 'TU_TOKEN_AQUI';

async function testGetSubscribers() {
  console.log('\n🔍 Probando: Obtener lista de suscriptores...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/admin/emails/subscribers`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log('✅ Suscriptores obtenidos:');
    console.log(`   - Total: ${data.total}`);
    console.log(`   - Jugadores: ${data.players}`);
    console.log(`   - Entrenadores: ${data.coaches}`);
    console.log(`   - Primeros 5 emails:`, data.subscribers.slice(0, 5).map(s => s.email));
    
    return data;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

async function testSendBulkEmail() {
  console.log('\n📧 Probando: Enviar email masivo...');
  
  const emailData = {
    target: 'all', // 'all', 'players', o 'coaches'
    subject: '🧪 Test - Email de Prueba del Sistema',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Email de Prueba</h2>
        <p>Este es un email de prueba del sistema de envío masivo.</p>
        <p><strong>Si ves este mensaje, el sistema está funcionando correctamente.</strong></p>
      </div>
    `,
    text: 'Este es un email de prueba del sistema de envío masivo.'
  };

  try {
    const response = await fetch(`${BASE_URL}/api/admin/emails/send-bulk`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log('✅ Email masivo enviado:');
    console.log(`   - Mensaje: ${data.message}`);
    console.log(`   - Total destinatarios: ${data.totalRecipients}`);
    console.log(`   - Exitosos: ${data.successCount}`);
    console.log(`   - Fallidos: ${data.failureCount}`);
    
    if (data.errors && data.errors.length > 0) {
      console.log('   - Errores:', data.errors);
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

async function runTests() {
  console.log('🚀 Iniciando pruebas del sistema de emails masivos...');
  console.log('=' .repeat(60));

  if (AUTH_TOKEN === 'TU_TOKEN_AQUI') {
    console.error('\n❌ ERROR: Debes configurar un token de autenticación válido');
    console.log('\nPasos para obtener un token:');
    console.log('1. Abre tu navegador en modo desarrollo (F12)');
    console.log('2. Ve a la pestaña Network/Red');
    console.log('3. Inicia sesión como admin en tu app');
    console.log('4. Busca alguna llamada a /api/admin/*');
    console.log('5. Copia el valor del header "Authorization" (sin "Bearer ")');
    console.log('6. Pega el token en este script');
    return;
  }

  try {
    // Test 1: Obtener suscriptores
    await testGetSubscribers();
    
    // Test 2: Enviar email masivo
    // DESCOMENTAR SOLO SI QUIERES PROBAR EL ENVÍO REAL
    // await testSendBulkEmail();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Todas las pruebas completadas exitosamente');
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ Las pruebas fallaron');
  }
}

// Ejecutar pruebas
runTests();




