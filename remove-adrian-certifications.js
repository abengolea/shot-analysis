// Script para eliminar certificaciones duplicadas de Adrian Bengolea
// Ejecutar con: node remove-adrian-certifications.js

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

async function removeAdrianCertifications() {
  try {
    console.log('🔍 Buscando entrenador Adrian Bengolea...\n');
    
    // Buscar por nombre
    const coachesSnapshot = await db.collection('coaches')
      .where('name', '==', 'Adrian Bengolea')
      .limit(1)
      .get();

    if (coachesSnapshot.empty) {
      console.log('❌ No se encontró el entrenador');
      return;
    }

    const coachDoc = coachesSnapshot.docs[0];
    const coachId = coachDoc.id;
    const coachData = coachDoc.data();
    
    console.log(`✅ Entrenador encontrado:`);
    console.log(`   ID: ${coachId}`);
    console.log(`   Nombre: ${coachData.name || 'N/A'}\n`);
    
    // Obtener certificaciones actuales
    const currentCertifications = Array.isArray(coachData.certifications) ? coachData.certifications : [];
    
    console.log('📋 Certificaciones actuales:');
    currentCertifications.forEach((cert, idx) => {
      console.log(`   ${idx + 1}. ${cert}`);
    });
    console.log('');
    
    // Eliminar las que están duplicadas en el curriculum
    const certificationsToRemove = [
      'Creador de Chaaaas.com',
      'Entrenador Eneba 1'
    ];
    
    const filteredCertifications = currentCertifications.filter(cert => 
      !certificationsToRemove.some(toRemove => cert.includes(toRemove) || toRemove.includes(cert))
    );
    
    console.log('🗑️  Eliminando certificaciones duplicadas...');
    console.log(`   Certificaciones antes: ${currentCertifications.length}`);
    console.log(`   Certificaciones después: ${filteredCertifications.length}\n`);
    
    if (filteredCertifications.length !== currentCertifications.length) {
      await db.collection('coaches').doc(coachId).update({
        certifications: filteredCertifications,
        updatedAt: new Date().toISOString(),
      });
      
      console.log('✅ Certificaciones actualizadas exitosamente\n');
      console.log('📋 Certificaciones finales:');
      filteredCertifications.forEach((cert, idx) => {
        console.log(`   ${idx + 1}. ${cert}`);
      });
    } else {
      console.log('ℹ️  No se encontraron certificaciones duplicadas para eliminar');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

removeAdrianCertifications();

