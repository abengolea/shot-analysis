/**
 * Script de prueba para AWS Rekognition
 * Ejecuta: node test-aws-rekognition.js
 */

const testVideoUrl = 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4';

async function testAWSRekognition() {
  console.log('🧪 Iniciando prueba de AWS Rekognition...');
  console.log('📹 Video de prueba:', testVideoUrl);
  
  try {
    const response = await fetch('http://localhost:3000/api/test-aws-rekognition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoUrl: testVideoUrl,
        ageCategory: 'Sub-15',
        playerLevel: 'Intermedio',
        shotType: 'Tiro libre',
      }),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Prueba exitosa!');
      console.log('📊 Resultados:');
      console.log('- Duración:', data.data.verificacion_inicial.duracion_video);
      console.log('- Tiros detectados:', data.data.verificacion_inicial.tiros_detectados);
      console.log('- Elementos:', data.data.verificacion_inicial.elementos_entorno.join(', '));
      console.log('- Score global:', data.data.resumen_evaluacion.score_global);
      console.log('- Confianza:', data.data.resumen_evaluacion.confianza_analisis);
    } else {
      console.error('❌ Error en la prueba:');
      console.error('- Error:', data.error);
      console.error('- Detalles:', data.details);
    }
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    console.log('💡 Asegúrate de que el servidor esté corriendo: npm run dev');
  }
}

// Ejecutar prueba
testAWSRekognition();
