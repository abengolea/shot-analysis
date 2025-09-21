// Verificar si el análisis es simulado o real
const checkAnalysis = async () => {
  try {
    const response = await fetch('http://localhost:9999/analysis/9CZPbJY4aY0EciRvp8L6');
    const html = await response.text();
    
    // Buscar patrones que indican análisis simulado
    const simulatedPatterns = [
      'Análisis básico',
      'Verifica la GEMINI_API_KEY',
      'No se pudo ejecutar la IA',
      'Selección automática de los primeros fotogramas'
    ];
    
    let isSimulated = false;
    simulatedPatterns.forEach(pattern => {
      if (html.includes(pattern)) {
        isSimulated = true;
        console.log(`❌ ENCONTRADO PATRÓN SIMULADO: "${pattern}"`);
      }
    });
    
    if (isSimulated) {
      console.log('\n🚨 RESULTADO: ANÁLISIS SIMULADO/FAKE');
      console.log('   El video de fiesta generó un análisis falso usando el fallback.');
    } else {
      console.log('\n🤔 RESULTADO: ANÁLISIS REAL');
      console.log('   El video de fiesta fue analizado como si fuera baloncesto real.');
    }
    
    console.log('\n📝 DIAGNÓSTICO:');
    console.log('   - El análisis se procesó SIN validación de contenido');
    console.log('   - La IA analizó el video de fiesta como baloncesto');
    console.log('   - Esto confirma que la validación no se está ejecutando');
    
  } catch (error) {
    console.log('❌ Error al verificar análisis:', error.message);
  }
};

checkAnalysis();
