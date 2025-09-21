// Script para probar el procesamiento completo de videos
const testFullProcessing = async () => {
  const baseUrl = 'http://localhost:9999';
  
  const testCases = [
    {
      name: "Video de fiesta (debería rechazar)",
      videoUrl: "gs://shotanalisys.firebasestorage.app/videos/test-user/123456789-party-video.mp4",
      filePath: "videos/test-user/123456789-party-video.mp4"
    },
    {
      name: "Video de baloncesto (debería aprobar)",
      videoUrl: "gs://shotanalisys.firebasestorage.app/videos/test-user/123456789-basketball-shot.mp4",
      filePath: "videos/test-user/123456789-basketball-shot.mp4"
    }
  ];

  console.log("🧪 Probando procesamiento completo de videos...\n");

  for (const testCase of testCases) {
    console.log(`📹 ${testCase.name}`);
    console.log(`   URL: ${testCase.videoUrl}`);
    console.log(`   Path: ${testCase.filePath}`);
    
    try {
      const response = await fetch(`${baseUrl}/api/test/process-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log(`   ✅ Procesado correctamente: ${result.message}`);
      } else {
        console.log(`   ❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Error de conexión: ${error.message}`);
    }
    
    console.log(''); // Línea en blanco
  }
};

// Ejecutar pruebas
testFullProcessing().then(() => {
  console.log("✅ Pruebas completadas");
}).catch(error => {
  console.log("❌ Error en las pruebas:", error.message);
});
