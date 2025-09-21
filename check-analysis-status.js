// Verificar el estado del análisis para ver si pasó por la validación
const checkAnalysisStatus = async () => {
  try {
    const response = await fetch('http://localhost:9999/analysis/B2q50Y4gretS0asG8veL');
    const html = await response.text();
    
    // Buscar indicadores de que pasó por validación
    const validationIndicators = [
      'status: \'rejected\'',
      'rejectionReason',
      'validationResult',
      'Video rechazado',
      'No contiene contenido válido de baloncesto'
    ];
    
    let foundValidation = false;
    validationIndicators.forEach(indicator => {
      if (html.includes(indicator)) {
        foundValidation = true;
        console.log(`✅ ENCONTRADO INDICADOR DE VALIDACIÓN: "${indicator}"`);
      }
    });
    
    if (foundValidation) {
      console.log('\n✅ RESULTADO: El video SÍ pasó por validación y fue rechazado');
      console.log('   Pero aún así se mostró un análisis. Hay un bug en la UI.');
    } else {
      console.log('\n❌ RESULTADO: El video NO pasó por validación');
      console.log('   El flujo de procesamiento no está ejecutando la validación.');
    }
    
    // Verificar si es análisis simulado
    const simulatedPatterns = [
      'Análisis básico',
      'Verifica la GEMINI_API_KEY',
      'No se pudo ejecutar la IA'
    ];
    
    let isSimulated = false;
    simulatedPatterns.forEach(pattern => {
      if (html.includes(pattern)) {
        isSimulated = true;
        console.log(`❌ ANÁLISIS SIMULADO: "${pattern}"`);
      }
    });
    
    if (isSimulated) {
      console.log('\n🚨 PROBLEMA: Análisis simulado - La IA falló y usó el fallback');
    } else {
      console.log('\n🤔 PROBLEMA: Análisis real - La IA analizó un video de fiesta como baloncesto');
    }
    
  } catch (error) {
    console.log('❌ Error al verificar análisis:', error.message);
  }
};

checkAnalysisStatus();
