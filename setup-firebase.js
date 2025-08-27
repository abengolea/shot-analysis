#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔥 Configurando Firebase para Shot Analysis App...\n');

// Verificar si existe .env.local
const envLocalPath = path.join(process.cwd(), '.env.local');
const envExamplePath = path.join(process.cwd(), 'env.example');

if (!fs.existsSync(envLocalPath)) {
  if (fs.existsSync(envExamplePath)) {
    console.log('📝 Creando archivo .env.local desde env.example...');
    const envContent = fs.readFileSync(envExamplePath, 'utf8');
    fs.writeFileSync(envLocalPath, envContent);
    console.log('✅ Archivo .env.local creado exitosamente');
  } else {
    console.log('❌ No se encontró el archivo env.example');
    process.exit(1);
  }
} else {
  console.log('✅ El archivo .env.local ya existe');
}

console.log('\n📋 Pasos siguientes:');
console.log('1. Edita el archivo .env.local con tus credenciales de Firebase Admin SDK');
console.log('2. Ve a la consola de Firebase y habilita Firestore Database y Storage');
console.log('3. Ejecuta: firebase login');
console.log('4. Ejecuta: firebase deploy --only firestore:rules,storage');
console.log('5. Ejecuta: npm run dev');

console.log('\n🔗 Enlaces útiles:');
console.log('- Consola de Firebase: https://console.firebase.google.com/');
console.log('- Documentación: https://firebase.google.com/docs');

console.log('\n📖 Lee FIREBASE_SETUP.md para instrucciones detalladas');
console.log('\n¡Configuración completada! 🎉');
