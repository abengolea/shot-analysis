// Script para actualizar el perfil de Adrian Bengolea
// Ejecutar con: node update-adrian-bengolea.js

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

async function updateAdrianBengolea() {
  try {
    console.log('🔍 Buscando entrenador Adrian Bengolea...\n');
    
    // Buscar por nombre
    const coachesSnapshot = await db.collection('coaches')
      .where('name', '==', 'Adrian Bengolea')
      .limit(1)
      .get();

    if (coachesSnapshot.empty) {
      // Buscar por email
      console.log('⚠️  No encontrado por nombre, buscando por email...\n');
      const emailSnapshot = await db.collection('coaches')
        .where('email', '==', 'abengolea1@gmail.com')
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
      console.log(`   Email: ${coachData.email || 'N/A'}\n`);
      
      // Actualizar curriculum (bio)
      const currentBio = coachData.bio || '';
      const newInfo = 'Creador de Chaaaas.com - Entrenador Eneba 1';
      
      // Si ya tiene bio, agregar la nueva información al inicio
      let newBio = '';
      if (currentBio) {
        // Verificar si ya contiene esta información
        if (!currentBio.includes('Creador de Chaaaas.com') && !currentBio.includes('Entrenador Eneba 1')) {
          newBio = `${newInfo}\n\n${currentBio}`;
        } else {
          newBio = currentBio; // Ya tiene la información
        }
      } else {
        newBio = newInfo;
      }
      
      console.log('📝 Actualizando curriculum (bio)...');
      console.log(`   Información a agregar: ${newInfo}\n`);
      
      await db.collection('coaches').doc(coachId).update({
        bio: newBio,
        updatedAt: new Date().toISOString(),
      });
      
      console.log('✅ Perfil actualizado exitosamente\n');
      return;
    }

    const coachDoc = coachesSnapshot.docs[0];
    const coachId = coachDoc.id;
    const coachData = coachDoc.data();
    
    console.log(`✅ Entrenador encontrado:`);
    console.log(`   ID: ${coachId}`);
    console.log(`   Nombre: ${coachData.name || 'N/A'}`);
    console.log(`   Email: ${coachData.email || 'N/A'}\n`);
    
    // Actualizar curriculum (bio)
    const currentBio = coachData.bio || '';
    const newInfo = 'Creador de Chaaaas.com - Entrenador Eneba 1';
    
    // Si ya tiene bio, agregar la nueva información al inicio
    let newBio = '';
    if (currentBio) {
      // Verificar si ya contiene esta información
      if (!currentBio.includes('Creador de Chaaaas.com') && !currentBio.includes('Entrenador Eneba 1')) {
        newBio = `${newInfo}\n\n${currentBio}`;
      } else {
        newBio = currentBio; // Ya tiene la información
      }
    } else {
      newBio = newInfo;
    }
    
    console.log('📝 Actualizando curriculum (bio)...');
    console.log(`   Información a agregar: ${newInfo}\n`);
    
    await db.collection('coaches').doc(coachId).update({
      bio: newBio,
      updatedAt: new Date().toISOString(),
    });
    
    console.log('✅ Perfil actualizado exitosamente\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

updateAdrianBengolea();

