// Verificar si hay análisis rechazados en la base de datos
const checkRejectedAnalyses = async () => {
  try {
    // Buscar análisis recientes que puedan haber sido rechazados
    const response = await fetch('http://localhost:9999/api/analyses/recent');
    const data = await response.json();
    
    if (data.analyses) {
      console.log(`📊 Análisis encontrados: ${data.analyses.length}`);
      
      data.analyses.forEach((analysis, index) => {
        console.log(`\n${index + 1}. ID: ${analysis.id}`);
        console.log(`   Estado: ${analysis.status || 'sin estado'}`);
        console.log(`   Resumen: ${analysis.analysisSummary?.substring(0, 100)}...`);
        
        if (analysis.status === 'rejected') {
          console.log(`   🚫 RECHAZADO: ${analysis.rejectionReason}`);
        } else if (analysis.status === 'error') {
          console.log(`   ❌ ERROR: ${analysis.errorMessage}`);
        }
      });
    } else {
      console.log('❌ No se pudieron obtener los análisis');
    }
    
  } catch (error) {
    console.log('❌ Error al verificar análisis:', error.message);
  }
};

checkRejectedAnalyses();
