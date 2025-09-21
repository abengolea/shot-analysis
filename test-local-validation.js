// Script para probar la validación de contenido en local
const testLocalValidation = async () => {
  const baseUrl = 'http://localhost:9999';
  
  const testCases = [
    {
      name: "Video de fiesta (debería rechazar)",
      videoUrl: "https://example.com/party-video.mp4",
      shotType: "Lanzamiento de prueba"
    },
    {
      name: "Video de baloncesto (debería aprobar)",
      videoUrl: "https://example.com/basketball-shot.mp4", 
      shotType: "Lanzamiento de tres puntos"
    },
    {
      name: "Video ambiguo (debería requerir revisión)",
      videoUrl: "https://example.com/sports-video.mp4",
      shotType: "Lanzamiento de prueba"
    }
  ];

  console.log("🧪 Probando validación de contenido en LOCAL...\n");

  for (const testCase of testCases) {
    console.log(`📹 ${testCase.name}`);
    console.log(`   URL: ${testCase.videoUrl}`);
    
    try {
      const response = await fetch(`${baseUrl}/api/process-video-local`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log(`   ✅ Resultado:`);
        console.log(`      - Estado: ${result.status}`);
        console.log(`      - ID: ${result.analysisId}`);
        console.log(`      - Mensaje: ${result.message}`);
        if (result.reason) {
          console.log(`      - Razón: ${result.reason}`);
        }
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
testLocalValidation().then(() => {
  console.log("✅ Pruebas completadas");
}).catch(error => {
  console.log("❌ Error en las pruebas:", error.message);
});
