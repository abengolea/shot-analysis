#!/usr/bin/env node

/**
 * Script de Verificación de Configuración de Emails
 * 
 * Verifica que todas las variables de entorno necesarias
 * para el envío de emails estén configuradas correctamente.
 * 
 * USO:
 *   node scripts/verify-email-config.js
 */

require('dotenv').config({ path: '.env.local' });

console.log('\n' + '='.repeat(60));
console.log('📧 VERIFICACIÓN DE CONFIGURACIÓN DE EMAILS');
console.log('='.repeat(60) + '\n');

// Verificar variables de entorno
const sendgridConfig = {
  'SENDGRID_API_KEY': process.env.SENDGRID_API_KEY,
  'SENDGRID_FROM_EMAIL': process.env.SENDGRID_FROM_EMAIL,
  'SENDGRID_FROM_NAME': process.env.SENDGRID_FROM_NAME,
};

const awsSesConfig = {
  'AWS_SES_REGION': process.env.AWS_SES_REGION || process.env.AWS_REGION,
  'AWS_SES_FROM_EMAIL': process.env.AWS_SES_FROM_EMAIL,
  'AWS_ACCESS_KEY_ID': process.env.AWS_ACCESS_KEY_ID,
  'AWS_SECRET_ACCESS_KEY': process.env.AWS_SECRET_ACCESS_KEY,
  'AWS_SES_FROM_NAME': process.env.AWS_SES_FROM_NAME,
};

const sendgridConfigured = !!(sendgridConfig.SENDGRID_API_KEY && sendgridConfig.SENDGRID_FROM_EMAIL);
const awsSesConfigured = !!(awsSesConfig.AWS_SES_REGION && awsSesConfig.AWS_SES_FROM_EMAIL && awsSesConfig.AWS_ACCESS_KEY_ID && awsSesConfig.AWS_SECRET_ACCESS_KEY);

console.log('OPCIÓN 1 - SendGrid:\n');

for (const [key, value] of Object.entries(sendgridConfig)) {
  const isOptional = key === 'SENDGRID_FROM_NAME';
  const status = value 
    ? '✅' 
    : isOptional 
      ? '⚠️  (opcional)' 
      : '❌';
  
  const displayValue = value 
    ? key === 'SENDGRID_API_KEY' 
      ? `${value.substring(0, 10)}...` 
      : value
    : 'NO CONFIGURADO';
  
  console.log(`  ${status} ${key}: ${displayValue}`);
}

console.log(`\n  → SendGrid: ${sendgridConfigured ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO'}\n`);

console.log('\nOPCIÓN 2 - AWS SES (Recomendado - 62k/mes gratis):\n');

for (const [key, value] of Object.entries(awsSesConfig)) {
  const isOptional = key === 'AWS_SES_FROM_NAME';
  const status = value 
    ? '✅' 
    : isOptional 
      ? '⚠️  (opcional)' 
      : '❌';
  
  const displayValue = value 
    ? (key === 'AWS_SECRET_ACCESS_KEY' || key === 'AWS_ACCESS_KEY_ID')
      ? `${value.substring(0, 8)}...` 
      : value
    : 'NO CONFIGURADO';
  
  console.log(`  ${status} ${key}: ${displayValue}`);
}

console.log(`\n  → AWS SES: ${awsSesConfigured ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO'}\n`);

let allOk = sendgridConfigured || awsSesConfigured;

console.log('\n' + '-'.repeat(60) + '\n');

// Verificar instalación de dependencias
console.log('Dependencias:\n');

let sendgridInstalled = false;
let awsSesInstalled = false;

try {
  require.resolve('@sendgrid/mail');
  sendgridInstalled = true;
  console.log('  ✅ @sendgrid/mail: Instalado');
} catch (e) {
  if (sendgridConfigured) {
    console.log('  ❌ @sendgrid/mail: NO INSTALADO (necesario para SendGrid)');
    console.log('     → Ejecuta: npm install @sendgrid/mail');
    allOk = false;
  } else {
    console.log('  ⚪ @sendgrid/mail: No instalado (no configurado)');
  }
}

try {
  require.resolve('@aws-sdk/client-ses');
  awsSesInstalled = true;
  console.log('  ✅ @aws-sdk/client-ses: Instalado');
} catch (e) {
  if (awsSesConfigured) {
    console.log('  ❌ @aws-sdk/client-ses: NO INSTALADO (necesario para AWS SES)');
    console.log('     → Ejecuta: npm install @aws-sdk/client-ses');
    allOk = false;
  } else {
    console.log('  ⚪ @aws-sdk/client-ses: No instalado (no configurado)');
  }
}

console.log('\n' + '-'.repeat(60) + '\n');

// Resultado final
if (allOk && (sendgridConfigured || awsSesConfigured)) {
  console.log('✅ TODO CONFIGURADO CORRECTAMENTE\n');
  
  if (awsSesConfigured) {
    console.log('📧 Usando AWS SES (62,000 emails/mes GRATIS)\n');
    console.log('Beneficios:');
    console.log('  • 62,000 emails gratis/mes (vs 3,000 de SendGrid)');
    console.log('  • Solo $0.10 por cada 1,000 emails adicionales');
    console.log('  • Excelente para escalar\n');
    console.log('IMPORTANTE: Asegúrate de:');
    console.log('  1. Haber verificado el email/dominio en AWS SES');
    console.log('  2. Solicitar salir del "Sandbox" si necesitas más de 200 emails/día');
    console.log('     (Se aprueba en ~24 horas)\n');
    console.log('Panel AWS SES: https://console.aws.amazon.com/ses/\n');
  } else if (sendgridConfigured) {
    console.log('📧 Usando SendGrid (100 emails/día gratis)\n');
    console.log('IMPORTANTE: Asegúrate de que el email esté verificado.');
    console.log('Verifica en: https://app.sendgrid.com/settings/sender_auth\n');
    console.log('💡 TIP: AWS SES es más económico para volúmenes grandes (62k/mes gratis).');
    console.log('Ver: docs/SETUP_AWS_SES.md\n');
  }
  
  console.log('Pruébalo en: http://localhost:9999/admin?tab=emails\n');
  
} else {
  console.log('⚠️  MODO LOG ONLY ACTIVADO\n');
  console.log('Los emails se registrarán en la consola pero NO se enviarán.\n');
  console.log('Opciones para habilitar envío real:\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('OPCIÓN A - SendGrid (Más Fácil):\n');
  console.log('  Límite: 100 emails/día gratis');
  console.log('  Setup: 5 minutos');
  console.log('  Guía: docs/IMPLEMENTAR_EMAILS_REAL.md\n');
  console.log('  Pasos:');
  console.log('  1. npm install @sendgrid/mail');
  console.log('  2. Cuenta en https://sendgrid.com');
  console.log('  3. Obtén API Key');
  console.log('  4. Verifica email');
  console.log('  5. Configura .env.local\n');
  
  console.log('OPCIÓN B - AWS SES (Más Económico - RECOMENDADO):\n');
  console.log('  Límite: 62,000 emails/mes gratis 🎉');
  console.log('  Costo después: $0.10 por 1,000 emails');
  console.log('  Setup: 10 minutos');
  console.log('  Guía: docs/SETUP_AWS_SES.md\n');
  console.log('  Pasos:');
  console.log('  1. npm install @aws-sdk/client-ses');
  console.log('  2. Habilita AWS SES en consola');
  console.log('  3. Verifica email/dominio');
  console.log('  4. Solicita salir del Sandbox');
  console.log('  5. Configura .env.local\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

console.log('='.repeat(60) + '\n');

// Código de salida
process.exit(allOk ? 0 : 1);

