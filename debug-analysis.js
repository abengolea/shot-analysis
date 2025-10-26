const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'shotanalisys'
  });
}

const db = admin.firestore();

async function debugAnalysis() {
  const analysisId = 'analysis_1761396121944_8bjaat7wf';
  
  console.log('🔍 Investigando análisis:', analysisId);
  
  try {
    // 1. Verificar si el análisis existe
    const analysisDoc = await db.collection('analyses').doc(analysisId).get();
    
    if (!analysisDoc.exists) {
      console.log('❌ Análisis no encontrado en la base de datos');
      return;
    }
    
    const analysisData = analysisDoc.data();
    console.log('✅ Análisis encontrado');
    console.log('📊 Datos del análisis:');
    console.log('- ID:', analysisDoc.id);
    console.log('- Creado:', analysisData.createdAt);
    console.log('- Estado:', analysisData.status);
    console.log('- Método:', analysisData.analysisMethod);
    
    // 2. Verificar keyframes
    console.log('\n🔍 Verificando keyframes:');
    console.log('- keyframes existe:', !!analysisData.keyframes);
    
    if (analysisData.keyframes) {
      console.log('- Estructura keyframes:', JSON.stringify(analysisData.keyframes, null, 2));
    } else {
      console.log('❌ No hay keyframes en el análisis');
    }
    
    // 3. Verificar smart keyframes
    console.log('\n🔍 Verificando smart keyframes:');
    const smartKeyframesDoc = await db.collection('smart_keyframes').doc(analysisId).get();
    
    if (smartKeyframesDoc.exists) {
      const smartData = smartKeyframesDoc.data();
      console.log('✅ Smart keyframes encontrados');
      console.log('- Estructura:', JSON.stringify(smartData, null, 2));
    } else {
      console.log('❌ No hay smart keyframes');
    }
    
    // 4. Verificar videos disponibles
    console.log('\n🔍 Verificando videos:');
    const videoKeys = ['videoUrl', 'videoFrontUrl', 'videoBackUrl', 'videoLeftUrl', 'videoRightUrl'];
    videoKeys.forEach(key => {
      if (analysisData[key]) {
        console.log(`- ${key}: ${analysisData[key]}`);
      }
    });
    
    // 5. Verificar logs de procesamiento
    console.log('\n🔍 Verificando logs de procesamiento:');
    const logsQuery = await db.collection('processing_logs')
      .where('analysisId', '==', analysisId)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    if (!logsQuery.empty) {
      console.log('✅ Logs encontrados:');
      logsQuery.forEach(doc => {
        const logData = doc.data();
        console.log(`- ${logData.timestamp}: ${logData.message}`);
        if (logData.error) {
          console.log(`  Error: ${logData.error}`);
        }
      });
    } else {
      console.log('❌ No hay logs de procesamiento');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugAnalysis().then(() => {
  console.log('\n✅ Debug completado');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
