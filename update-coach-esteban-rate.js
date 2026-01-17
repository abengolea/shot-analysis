// Script para actualizar la tarifa del entrenador Esteban Daniel Velasco a 25.000 ARS
// Ejecutar con: node update-coach-esteban-rate.js

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

async function updateCoachRate() {
  try {
    console.log('🔍 Buscando entrenador "Esteban Daniel Velasco"...');

    // Buscar por nombre
    const coachesSnapshot = await db.collection('coaches')
      .where('name', '==', 'Esteban Daniel Velasco')
      .limit(1)
      .get();

    if (coachesSnapshot.empty) {
      console.log('⚠️  No encontrado por nombre, buscando por email...');

      // Buscar por email
      const emailSnapshot = await db.collection('coaches')
        .where('email', '==', 'profevelasco80@gmail.com')
        .limit(1)
        .get();

      if (emailSnapshot.empty) {
        console.log('❌ No se encontró el entrenador');
        return;
      }

      const coachDoc = emailSnapshot.docs[0];
      const coachId = coachDoc.id;
      const coachData = coachDoc.data();

      console.log('✅ Entrenador encontrado por email:');
      console.log(`   ID: ${coachId}`);
      console.log(`   Nombre: ${coachData.name || 'N/A'}`);
      console.log(`   Email: ${coachData.email || 'N/A'}`);
      console.log(`   Tarifa actual: $${coachData.ratePerAnalysis || 'No configurada'} ARS`);

      // Actualizar tarifa y visibilidad
      const newRate = 25000;
      await db.collection('coaches').doc(coachId).update({
        ratePerAnalysis: newRate,
        showRate: true,
        updatedAt: new Date().toISOString(),
      });

      console.log(`✅ Tarifa actualizada a $${newRate} ARS`);
      console.log(`💰 Con comisión del 30%: $${newRate + Math.round(newRate * 0.3)} ARS total`);
      return;
    }

    const coachDoc = coachesSnapshot.docs[0];
    const coachId = coachDoc.id;
    const coachData = coachDoc.data();

    console.log('✅ Entrenador encontrado:');
    console.log(`   ID: ${coachId}`);
    console.log(`   Nombre: ${coachData.name || 'N/A'}`);
    console.log(`   Email: ${coachData.email || 'N/A'}`);
    console.log(`   Tarifa actual: $${coachData.ratePerAnalysis || 'No configurada'} ARS`);

    // Actualizar tarifa y visibilidad
    const newRate = 25000;
    await db.collection('coaches').doc(coachId).update({
      ratePerAnalysis: newRate,
      showRate: true,
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
