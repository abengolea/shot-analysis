import { adminStorage } from '@/lib/firebase-admin';

export async function cleanupOldFrames() {
  try {
    console.log('🧹 Iniciando limpieza de frames antiguos (solo FREE)...');
    
    const bucket = adminStorage.bucket();
    
    // Listar archivos de limpieza programada (solo FREE)
    const [cleanupFiles] = await bucket.getFiles({
      prefix: 'cleanup/'
    });
    
    const now = new Date();
    let cleanedCount = 0;
    let skippedCount = 0;
    
    for (const file of cleanupFiles) {
      try {
        // Leer archivo de limpieza
        const [content] = await file.download();
        const cleanupData = JSON.parse(content.toString());
        
        // Solo limpiar análisis FREE
        if (cleanupData.userType === 'FREE') {
          // Verificar si es hora de limpiar
          const scheduledFor = new Date(cleanupData.scheduledFor);
          if (now >= scheduledFor) {
            const analysisId = cleanupData.analysisId;
            
            // Listar y eliminar todos los frames de este análisis
            const [frameFiles] = await bucket.getFiles({
              prefix: `frames/${analysisId}/`
            });
            
            if (frameFiles.length > 0) {
              await Promise.all(frameFiles.map(frameFile => frameFile.delete()));
                            cleanedCount += frameFiles.length;
            }
            
            // Eliminar archivo de limpieza
            await file.delete();
          }
        } else {
                    skippedCount++;
        }
      } catch (fileError) {
        console.error(`❌ Error procesando archivo de limpieza ${file.name}:`, fileError);
      }
    }
    
        return { cleanedCount, skippedCount };
    
  } catch (error) {
    console.error('❌ Error en limpieza de frames:', error);
    return { cleanedCount: 0, skippedCount: 0 };
  }
}

// Función para ejecutar limpieza manual (útil para testing)
export async function cleanupSpecificAnalysis(analysisId: string) {
  try {
    const bucket = adminStorage.bucket();
    
    // Listar y eliminar todos los frames de este análisis
    const [frameFiles] = await bucket.getFiles({
      prefix: `frames/${analysisId}/`
    });
    
    if (frameFiles.length > 0) {
      await Promise.all(frameFiles.map(file => file.delete()));
            return frameFiles.length;
    }
    
        return 0;
    
  } catch (error) {
    console.error(`❌ Error limpiando análisis ${analysisId}:`, error);
    return 0;
  }
}

// Función para limpiar análisis PRO (cuando el usuario cancela suscripción)
export async function cleanupProAnalysis(analysisId: string) {
  try {
    const bucket = adminStorage.bucket();
    
    // Verificar que es un análisis PRO
    const permanentFile = bucket.file(`permanent/${analysisId}.json`);
    const [exists] = await permanentFile.exists();
    
    if (!exists) {
      console.log(`ℹ️ Análisis ${analysisId} no es PRO o no existe`);
      return 0;
    }
    
    // Eliminar archivo permanente
    await permanentFile.delete();
    
    // Listar y eliminar todos los frames de este análisis
    const [frameFiles] = await bucket.getFiles({
      prefix: `frames/${analysisId}/`
    });
    
    if (frameFiles.length > 0) {
      await Promise.all(frameFiles.map(file => file.delete()));
            return frameFiles.length;
    }
    
        return 0;
    
  } catch (error) {
    console.error(`❌ Error limpiando análisis PRO ${analysisId}:`, error);
    return 0;
  }
}

// Función para obtener estadísticas de almacenamiento
export async function getStorageStats() {
  try {
    const bucket = adminStorage.bucket();
    
    // Contar análisis FREE programados para limpieza
    const [cleanupFiles] = await bucket.getFiles({ prefix: 'cleanup/' });
    
    // Contar análisis PRO permanentes
    const [permanentFiles] = await bucket.getFiles({ prefix: 'permanent/' });
    
    // Contar frames totales
    const [frameFiles] = await bucket.getFiles({ prefix: 'frames/' });
    
    return {
      freeAnalyses: cleanupFiles.length,
      proAnalyses: permanentFiles.length,
      totalFrames: frameFiles.length,
      totalAnalyses: cleanupFiles.length + permanentFiles.length
    };
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    return null;
  }
}
