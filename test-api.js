const testData = {
  videoUrl: "https://firebasestorage.googleapis.com/v0/b/shot-analysis.appspot.com/o/videos%2Ftest-video.mp4?alt=media",
  ageCategory: "Sub-15",
  playerLevel: "Avanzado", 
  shotType: "Lanzamiento de Tres",
  availableKeyframes: []
};

fetch('http://localhost:9999/api/test-free-vs-pro', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testData)
})
.then(response => response.json())
.then(data => {
  console.log('✅ Respuesta:', data);
  console.log('🎯 Tiros detectados:', data.verificacion_inicial?.tiros_detectados);
  console.log('📊 Parámetros evaluados:', data.resumen_evaluacion?.parametros_evaluados);
})
.catch(error => {
  console.error('❌ Error:', error);
});

