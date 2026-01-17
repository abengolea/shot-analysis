// Script para arreglar el campo avatarUrl del entrenador Esteban Velasco
// Ejecutar con: node fix-coach-avatar.js
// Requiere: tener las variables de entorno configuradas en .env.local

// Cargar variables de entorno desde .env.local
require('dotenv').config({ path: '.env.local' });

const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 'shotanalisys',
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.projectId,
  });
}

const db = admin.firestore();

async function fixCoachAvatar() {
  try {
    console.log('🔍 Buscando entrenador Esteban Daniel Velasco...\n');
    
    // Buscar por nombre
    const coachesSnapshot = await db.collection('coaches')
      .where('name', '==', 'Esteban Daniel Velasco')
      .limit(1)
      .get();

    if (coachesSnapshot.empty) {
      // Buscar por email
      console.log('⚠️  No encontrado por nombre, buscando por email...\n');
      const emailSnapshot = await db.collection('coaches')
        .where('email', '==', 'profevelasco80@gmail.com')
        .limit(1)
        .get();
      
      if (emailSnapshot.empty) {
        console.log('❌ No se encontró el entrenador');
        console.log('📋 Listando todos los entrenadores...\n');
        
        const allCoaches = await db.collection('coaches').limit(20).get();
        allCoaches.forEach(doc => {
          const data = doc.data();
          console.log(`  - ID: ${doc.id}`);
          console.log(`    Nombre: ${data.name || 'N/A'}`);
          console.log(`    Email: ${data.email || 'N/A'}`);
          console.log(`    photoUrl: ${data.photoUrl ? '✓' : '✗'}`);
          console.log(`    avatarUrl: ${data.avatarUrl ? '✓' : '✗'}`);
          console.log('');
        });
        return;
      }
      
      const coachDoc = emailSnapshot.docs[0];
      const coachId = coachDoc.id;
      const coachData = coachDoc.data();
      
      console.log(`✅ Entrenador encontrado por email:`);
      console.log(`   ID: ${coachId}`);
      console.log(`   Nombre: ${coachData.name || 'N/A'}`);
      console.log(`   Email: ${coachData.email || 'N/A'}`);
      console.log(`   photoUrl: ${coachData.photoUrl || 'No tiene'}`);
      console.log(`   avatarUrl: ${coachData.avatarUrl || 'No tiene'}\n`);
      
      // Actualizar avatarUrl si hay photoUrl pero no avatarUrl
      if (coachData.photoUrl && !coachData.avatarUrl) {
        console.log('🔧 Actualizando avatarUrl con el valor de photoUrl...');
        await db.collection('coaches').doc(coachId).update({
          avatarUrl: coachData.photoUrl,
          updatedAt: new Date().toISOString(),
        });
        console.log(`✅ avatarUrl actualizado: ${coachData.photoUrl}\n`);
      } else if (!coachData.photoUrl) {
        console.log('⚠️  El entrenador no tiene photoUrl. Necesitas subir una foto primero.\n');
      } else {
        console.log('✅ El entrenador ya tiene avatarUrl configurado.\n');
      }
      
      return;
    }

    const coachDoc = coachesSnapshot.docs[0];
    const coachId = coachDoc.id;
    const coachData = coachDoc.data();
    
    console.log(`✅ Entrenador encontrado:`);
    console.log(`   ID: ${coachId}`);
    console.log(`   Nombre: ${coachData.name || 'N/A'}`);
    console.log(`   Email: ${coachData.email || 'N/A'}`);
    console.log(`   photoUrl: ${coachData.photoUrl || 'No tiene'}`);
    console.log(`   avatarUrl: ${coachData.avatarUrl || 'No tiene'}\n`);
    
    // Actualizar avatarUrl si hay photoUrl pero no avatarUrl
    if (coachData.photoUrl && !coachData.avatarUrl) {
      console.log('🔧 Actualizando avatarUrl con el valor de photoUrl...');
      await db.collection('coaches').doc(coachId).update({
        avatarUrl: coachData.photoUrl,
        updatedAt: new Date().toISOString(),
      });
      console.log(`✅ avatarUrl actualizado: ${coachData.photoUrl}\n`);
    } else if (!coachData.photoUrl) {
      console.log('⚠️  El entrenador no tiene photoUrl. Necesitas subir una foto primero.\n');
    } else {
      console.log('✅ El entrenador ya tiene avatarUrl configurado.\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

fixCoachAvatar();

