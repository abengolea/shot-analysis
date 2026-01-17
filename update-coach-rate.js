// Script para actualizar la tarifa del entrenador Adrian Bengolea a 50 ARS
// Ejecutar con: node update-coach-rate.js

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

async function updateCoachRate() {
  try {
    console.log('🔍 Buscando entrenador "Adrian Bengolea"...');
    
    // Buscar por nombre
    const coachesSnapshot = await db.collection('coaches')
      .where('name', '==', 'Adrian Bengolea')
      .limit(1)
      .get();

    if (coachesSnapshot.empty) {
      console.log('❌ No se encontró el entrenador "Adrian Bengolea"');
      console.log('💡 Intentando buscar por email o ID...');
      
      // Buscar por email si existe
      const emailSnapshot = await db.collection('coaches')
        .where('email', '==', 'abengolea1@gmail.com')
        .limit(1)
        .get();
      
      if (emailSnapshot.empty) {
        console.log('❌ No se encontró el entrenador por email tampoco');
        console.log('📋 Listando todos los entrenadores para encontrar el ID...');
        
        const allCoaches = await db.collection('coaches').limit(10).get();
        allCoaches.forEach(doc => {
          const data = doc.data();
          console.log(`  - ID: ${doc.id}, Nombre: ${data.name || 'N/A'}, Email: ${data.email || 'N/A'}`);
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
      console.log(`   Tarifa actual: $${coachData.ratePerAnalysis || 'No configurada'} ARS`);
      
      // Actualizar tarifa
      const newRate = 50;
      await db.collection('coaches').doc(coachId).update({
        ratePerAnalysis: newRate,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`✅ Tarifa actualizada a $${newRate} ARS`);
      console.log(`💰 Con comisión del 30%: $${newRate + Math.round(newRate * 0.3)} ARS total`);
      return;
    }

    const coachDoc = coachesSnapshot.docs[0];
    const coachId = coachDoc.id;
    const coachData = coachDoc.data();
    
    console.log(`✅ Entrenador encontrado:`);
    console.log(`   ID: ${coachId}`);
    console.log(`   Nombre: ${coachData.name || 'N/A'}`);
    console.log(`   Email: ${coachData.email || 'N/A'}`);
    console.log(`   Tarifa actual: $${coachData.ratePerAnalysis || 'No configurada'} ARS`);
    
    // Actualizar tarifa
    const newRate = 50;
    await db.collection('coaches').doc(coachId).update({
      ratePerAnalysis: newRate,
      updatedAt: new Date().toISOString(),
    });
    
    console.log(`✅ Tarifa actualizada a $${newRate} ARS`);
    console.log(`💰 Con comisión del 30%: $${newRate + Math.round(newRate * 0.3)} ARS total`);
    console.log(`   - Tarifa del entrenador: $${newRate} ARS`);
    console.log(`   - Comisión de plataforma (30%): $${Math.round(newRate * 0.3)} ARS`);
    console.log(`   - Total a pagar: $${newRate + Math.round(newRate * 0.3)} ARS`);
    
  } catch (error) {
    console.error('❌ Error actualizando tarifa:', error);
  } finally {
    process.exit(0);
  }
}

updateCoachRate();


