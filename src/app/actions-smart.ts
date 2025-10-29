"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';
import { sendCustomEmail } from '@/lib/email-service';
import { extractAndUploadSmartKeyframesAsync } from '@/lib/smart-keyframes';
import { isMaintenanceMode } from '@/lib/maintenance';

// Función de análisis con keyframes inteligentes (basada en startAnalysis original)
export async function startAnalysisWithSmartKeyframes(prevState: any, formData: FormData) {
    try {
        // Verificar si el sistema está en modo mantenimiento general
        const maintenanceEnabled = await isMaintenanceMode();
        if (maintenanceEnabled) {
            return { 
                message: "El sistema está en mantenimiento. El análisis de lanzamientos está temporalmente deshabilitado.", 
                error: true 
            };
        }

        const userId = formData.get('userId') as string;
        const coachId = (formData.get('coachId') as string | null) || null;
        if (!userId) return { message: "ID de usuario requerido.", error: true };
        const shotType = formData.get('shotType') as string;
        if (!shotType) return { message: "Tipo de lanzamiento requerido.", error: true };
        
        // Verificar mantenimiento específico por tipo de tiro
        const { isShotTypeInMaintenance, normalizeShotType } = await import('@/lib/maintenance');
        const normalizedShotType = normalizeShotType(shotType);
        const shotTypeMaintenance = await isShotTypeInMaintenance(normalizedShotType);
        if (shotTypeMaintenance) {
            return { 
                message: `El análisis de ${shotType} está actualmente en mantenimiento. Por favor, intenta con otro tipo de tiro o vuelve más tarde.`, 
                error: true 
            };
        }
        
        const ageCategory = formData.get('ageCategory') as string || 'adult';
        const playerLevel = formData.get('playerLevel') as string || 'intermediate';
        
        // Extraer videos (hasta 4)
        const videoFile1 = formData.get('video1') as File | null;
        const videoFile2 = formData.get('video2') as File | null;
        const videoFile3 = formData.get('video3') as File | null;
        const videoFile4 = formData.get('video4') as File | null;

        // Validar que al menos un video esté presente (cualquiera de los 4)
        const hasAnyVideo = (videoFile1 && videoFile1.size > 0) || 
                           (videoFile2 && videoFile2.size > 0) || 
                           (videoFile3 && videoFile3.size > 0) || 
                           (videoFile4 && videoFile4.size > 0);
        
        if (!hasAnyVideo) {
            return { message: "Al menos un video es requerido.", error: true };
        }

        console.log('📹 Videos recibidos:', {
            video1: videoFile1 ? `${Math.round(videoFile1.size / 1024)}KB` : 'N/A',
            video2: videoFile2 ? `${Math.round(videoFile2.size / 1024)}KB` : 'N/A',
            video3: videoFile3 ? `${Math.round(videoFile3.size / 1024)}KB` : 'N/A',
            video4: videoFile4 ? `${Math.round(videoFile4.size / 1024)}KB` : 'N/A'
        });

        // Crear análisis en Firestore
        const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        
        if (!adminDb) return { message: "Base de datos no disponible.", error: true };

        // Subir videos a Storage y obtener URLs permanentes (igual que startAnalysis)
        console.log('📤 Subiendo videos a Storage...');
        const { uploadVideoToStorage } = await import('@/lib/storage-utils');
        
        // Mapeo: video1=back, video2=front, video3=left, video4=right
        let videoUrl: string | null = null;
        let videoBackUrl: string | null = null;
        let videoFrontUrl: string | null = null;
        let videoLeftUrl: string | null = null;
        let videoRightUrl: string | null = null;
        
        if (videoFile1) {
            videoBackUrl = await uploadVideoToStorage(videoFile1, userId, { maxSeconds: 30 });
            videoUrl = videoBackUrl; // El back es el video principal
                    }
        
        if (videoFile2) {
            videoFrontUrl = await uploadVideoToStorage(videoFile2, userId, { maxSeconds: 30 });
            if (!videoUrl) videoUrl = videoFrontUrl; // Si no hay back, front es el principal
                    }
        
        if (videoFile3) {
            videoLeftUrl = await uploadVideoToStorage(videoFile3, userId, { maxSeconds: 30 });
                    }
        
        if (videoFile4) {
            videoRightUrl = await uploadVideoToStorage(videoFile4, userId, { maxSeconds: 30 });
                    }

                // Guardar análisis inicial con URLs de videos
        await adminDb.collection('analyses').doc(analysisId).set({
            id: analysisId,
            playerId: userId,
            coachId,
            status: 'analyzing',
            shotType,
            ageCategory,
            playerLevel,
            createdAt: now,
            updatedAt: now,
            analysisType: 'smart-keyframes', // Análisis con keyframes inteligentes
            videoUrl,
            videoBackUrl,
            videoFrontUrl,
            videoLeftUrl,
            videoRightUrl
        });

        // Preprocesar videos con FFmpeg (usando la misma lógica que startAnalysis)
        console.log('⚙️ Preprocesando videos con FFmpeg...');
        
        const { preprocessVideo } = await import('@/lib/gemini-video-real');
        
        // Procesar videos (solo los que existen)
        const videoBuffers: Buffer[] = [];
        const videoFiles = [videoFile1, videoFile2, videoFile3, videoFile4];
        
        for (let i = 0; i < videoFiles.length; i++) {
            const file = videoFiles[i];
            if (file) {
                                const buffer = Buffer.from(await file.arrayBuffer());
                                try {
                    const result = await preprocessVideo(buffer, file.name);
                    // preprocessVideo devuelve { optimizedVideo, videoInfo }
                    const processed = result.optimizedVideo || result;
                    
                    if (Buffer.isBuffer(processed)) {
                        videoBuffers.push(processed);
                        console.log(`✅ Video ${i + 1} procesado: ${(processed.length / 1024 / 1024).toFixed(2)}MB`);
                    } else {
                        console.warn(`⚠️ Video ${i + 1} no procesado correctamente, usando original`);
                        videoBuffers.push(buffer);
                    }
                } catch (error) {
                    console.warn(`⚠️ Error procesando video ${i + 1}, usando original:`, error);
                    videoBuffers.push(buffer);
                }
            } else {
                videoBuffers.push(Buffer.alloc(0)); // Buffer vacío para mantener índices
            }
        }

        // Análisis con Gemini (usando la MISMA función que la página principal)
        console.log('🧠 Analizando con Gemini (misma función que página principal)...');
        const { analyzeVideoSimplePrompt } = await import('@/utils/gemini-simple-prompt');
        
        console.log('📹 Videos para análisis:', {
            video1: videoFile1 ? `${(videoBuffers[0]?.length / 1024 / 1024).toFixed(2)}MB` : 'N/A',
            video2: videoFile2 ? `${(videoBuffers[1]?.length / 1024 / 1024).toFixed(2)}MB` : 'N/A',
            video3: videoFile3 ? `${(videoBuffers[2]?.length / 1024 / 1024).toFixed(2)}MB` : 'N/A',
            video4: videoFile4 ? `${(videoBuffers[3]?.length / 1024 / 1024).toFixed(2)}MB` : 'N/A'
        });
        
        // Determinar cuál es el video principal (el primero que existe)
        let primaryVideoBuffer: Buffer;
        let primaryVideoName: string;
        let secondaryVideoBuffer: Buffer | null = null;
        let secondaryVideoName: string | null = null;
        let tertiaryVideoBuffer: Buffer | null = null;
        let tertiaryVideoName: string | null = null;

        if (videoFile1 && videoBuffers[0] && videoBuffers[0].length > 0) {
            primaryVideoBuffer = videoBuffers[0];
            primaryVideoName = videoFile1.name;
            secondaryVideoBuffer = videoBuffers[1] && videoBuffers[1].length > 0 ? videoBuffers[1] : null;
            secondaryVideoName = videoFile2?.name || null;
            tertiaryVideoBuffer = videoBuffers[2] && videoBuffers[2].length > 0 ? videoBuffers[2] : null;
            tertiaryVideoName = videoFile3?.name || null;
        } else if (videoFile2 && videoBuffers[1] && videoBuffers[1].length > 0) {
            primaryVideoBuffer = videoBuffers[1];
            primaryVideoName = videoFile2.name;
            secondaryVideoBuffer = videoBuffers[0] && videoBuffers[0].length > 0 ? videoBuffers[0] : null;
            secondaryVideoName = videoFile1?.name || null;
            tertiaryVideoBuffer = videoBuffers[2] && videoBuffers[2].length > 0 ? videoBuffers[2] : null;
            tertiaryVideoName = videoFile3?.name || null;
        } else if (videoFile3 && videoBuffers[2] && videoBuffers[2].length > 0) {
            primaryVideoBuffer = videoBuffers[2];
            primaryVideoName = videoFile3.name;
            secondaryVideoBuffer = videoBuffers[0] && videoBuffers[0].length > 0 ? videoBuffers[0] : null;
            secondaryVideoName = videoFile1?.name || null;
            tertiaryVideoBuffer = videoBuffers[1] && videoBuffers[1].length > 0 ? videoBuffers[1] : null;
            tertiaryVideoName = videoFile2?.name || null;
        } else if (videoFile4 && videoBuffers[3] && videoBuffers[3].length > 0) {
            primaryVideoBuffer = videoBuffers[3];
            primaryVideoName = videoFile4.name;
            secondaryVideoBuffer = videoBuffers[0] && videoBuffers[0].length > 0 ? videoBuffers[0] : null;
            secondaryVideoName = videoFile1?.name || null;
            tertiaryVideoBuffer = videoBuffers[1] && videoBuffers[1].length > 0 ? videoBuffers[1] : null;
            tertiaryVideoName = videoFile2?.name || null;
        } else {
            throw new Error('No se encontró ningún video válido para procesar');
        }

        console.log('🎯 Video principal seleccionado:', {
            name: primaryVideoName,
            size: `${(primaryVideoBuffer.length / 1024 / 1024).toFixed(2)}MB`
        });

        const analysisResult = await analyzeVideoSimplePrompt(
            primaryVideoBuffer,
            primaryVideoName,
            secondaryVideoBuffer,
            secondaryVideoName,
            tertiaryVideoBuffer,
            tertiaryVideoName,
            ageCategory,
            playerLevel,
            shotType
        );

                // ⚖️ CALCULAR SCORE GLOBAL CON PESOS CONFIGURABLES (igual que startAnalysis)
                const { loadWeightsFromFirestore } = await import('@/lib/scoring');
        
        // Determinar tipo de tiro para cargar pesos correspondientes
        let shotTypeKey = 'tres';
        if (shotType.toLowerCase().includes('media')) {
            shotTypeKey = 'media';
        } else if (shotType.toLowerCase().includes('libre')) {
            shotTypeKey = 'libre';
        }
        
        const customWeights = await loadWeightsFromFirestore(shotTypeKey);
        console.log(`📊 Pesos cargados para ${shotTypeKey}:`, Object.keys(customWeights).length, 'parámetros');
        
        // Calcular score ponderado usando los pesos configurables
        const parameters = analysisResult.technicalAnalysis?.parameters || [];
        let weightedScore = 0;
        let totalWeight = 0;
        let evaluableCount = 0;
        let nonEvaluableCount = 0;
        
        // Función para normalizar el nombre del parámetro a un ID (igual que startAnalysis)
        const normalizeParamName = (name: string): string => {
            // Primero normalizar y limpiar
            let normalized = name
                .toLowerCase()
                .trim()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
                .replace(/\s+/g, '_') // Espacios a guiones bajos
                .replace(/[^a-z0-9_]/g, ''); // Solo letras, números y guiones bajos
            
            // Mapeo específico para manejar diferencias entre nombres de IA y claves de pesos (igual que actions.ts)
            const mapping: Record<string, string> = {
                // PREPARACIÓN (Común para tres y libre)
                'alineacion_de_pies': 'alineacion_pies',
                'alineacion_de_los_pies': 'alineacion_pies',
                'alineacion_corporal': 'alineacion_cuerpo',
                'alineacion_del_cuerpo': 'alineacion_cuerpo',
                'alineacion_pies_cuerpo': 'alineacion_pies_cuerpo',
                'flexion_de_rodillas': 'flexion_rodillas',
                'flexion_rodillas': 'flexion_rodillas',
                'muneca_cargada': 'muneca_cargada_libre',
                'posicion_inicial_del_balon': 'posicion_inicial_balon',
                'posicion_inicial_balon': 'posicion_inicial_balon',
                'rutina_pre_tiro': 'rutina_pre_tiro',
                'rutina_pretiro': 'rutina_pre_tiro',
                
                // ASCENSO (Común para tres y libre)
                'mano_no_dominante_en_ascenso': 'mano_no_dominante_ascenso',
                'codos_cerca_del_cuerpo': 'codos_cerca_cuerpo',
                'codos_cerca_del_cuerpo_libre': 'codos_cerca_cuerpo_libre',
                'subida_recta_del_balon': 'subida_recta_balon',
                'trayectoria_del_balon_hasta_el_set_point': 'trayectoria_hasta_set_point',
                'trayectoria_del_balon_hasta_set_point': 'trayectoria_hasta_set_point',
                'trayectoria_hasta_el_set_point': 'trayectoria_hasta_set_point',
                'trayectoria_vertical': 'trayectoria_vertical_libre',
                'trayectoria_vertical_libre': 'trayectoria_vertical_libre',
                'mano_guia': 'mano_guia_libre',
                'mano_guia_libre': 'mano_guia_libre',
                'set_point': 'set_point',
                'set_point_altura_segun_edad': 'set_point_altura_edad',
                'set_point_altura_edad': 'set_point_altura_edad',
                'tiempo_de_lanzamiento': 'tiempo_lanzamiento',
                
                // FLUIDEZ
                'tiro_en_un_solo_tiempo': 'tiro_un_solo_tiempo',
                'tiro_un_solo_tiempo': 'tiro_un_solo_tiempo',
                'tiro_un_solo_tiempo_libre': 'tiro_un_solo_tiempo_libre',
                'transferencia_energetica_sincronia_con_piernas': 'sincronia_piernas',
                'transferencia_energetica__sincronia_con_piernas': 'sincronia_piernas',
                'sincronia_con_piernas': 'sincronia_piernas',
                'sincronia_piernas': 'sincronia_piernas',
                'sincronia_piernas_libre': 'sincronia_piernas_libre',
                
                // LIBERACIÓN
                'mano_no_dominante_en_liberacion': 'mano_no_dominante_liberacion',
                'mano_no_dominante_en_la_liberacion': 'mano_no_dominante_liberacion',
                'extension_completa_del_brazo': 'extension_completa_brazo',
                'extension_completa': 'extension_completa_brazo',
                'extension_completa_liberacion': 'extension_completa_liberacion',
                'giro_de_la_pelota': 'giro_pelota',
                'rotacion_del_balon': 'rotacion_balon',
                'rotacion_balon': 'rotacion_balon',
                'giro_pelota': 'giro_pelota',
                'angulo_de_salida': 'angulo_salida',
                'angulo_salida': 'angulo_salida',
                'angulo_salida_libre': 'angulo_salida_libre',
                'flexion_muneca_final': 'flexion_muneca_final',
                'gooseneck': 'flexion_muneca_final',
                
                // SEGUIMIENTO
                'sin_salto': 'sin_salto_reglamentario',
                'sin_salto_reglamentario': 'sin_salto_reglamentario',
                'pies_dentro_zona': 'pies_dentro_zona',
                'pies_dentro_de_zona': 'pies_dentro_zona',
                'balance_vertical': 'balance_vertical',
                'equilibrio_post_liberacion_y_aterrizaje': 'equilibrio_general',
                'mantenimiento_del_equilibrio': 'equilibrio_general',
                'equilibrio_en_aterrizaje': 'equilibrio_general',
                'equilibrio_en_el_aterrizaje': 'equilibrio_general',
                'equilibrio_general': 'equilibrio_general',
                'duracion_del_follow_through': 'duracion_follow_through',
                'duracion_del_followthrough': 'duracion_follow_through',
                'follow_through_completo': 'follow_through_completo_libre',
                'follow_through_completo_libre': 'follow_through_completo_libre',
                
                // CONSISTENCIA (solo para tres puntos)
                'consistencia_del_movimiento': 'consistencia_general',
                'consistencia_tecnica': 'consistencia_general',
                'consistencia_de_resultados': 'consistencia_general',
                'consistencia_repetitiva': 'consistencia_general',
                'consistencia_general': 'consistencia_general'
            };
            
            return mapping[normalized] || normalized;
        };
        
        // Set para evitar contar el mismo parámetro dos veces
        const processedParams = new Set<string>();
        
        for (const param of parameters) {
            // Usar el campo id si existe, si no, normalizar el nombre
            const paramId = param.id ? param.id.trim().toLowerCase() : normalizeParamName(param.name || '');
            
            // Si ya procesamos este parámetro, saltar (evita duplicados)
            if (processedParams.has(paramId)) {
                console.log(`⏭️ Saltando parámetro duplicado: ${paramId} (nombre original: ${param.name})`);
                continue;
            }
            
            const weight = customWeights[paramId] || 0;
            
            if (weight === 0) {
                console.warn(`⚠️ Parámetro sin peso: ${paramId} (nombre original: ${param.name})`);
                continue;
            }
            
            // Marcar como procesado
            processedParams.add(paramId);
            
            // Si el parámetro es evaluable (tiene score válido)
            if (param.status !== 'no_evaluable' && typeof param.score === 'number' && param.score > 0) {
                weightedScore += weight * param.score;
                totalWeight += weight;
                evaluableCount++;
                console.log(`✅ ${paramId}: score=${param.score}, peso=${weight}%, contribución=${(weight * param.score).toFixed(2)}`);
            } else {
                nonEvaluableCount++;
                console.log(`⚠️ ${paramId}: no evaluable (status=${param.status})`);
            }
        }
        
        // Normalizar el score final (igual que startAnalysis)
        // Formula: Σ(peso_i × score_i) / Σ(peso_i)
        // Promedio ponderado: suma de (peso × score) dividido por suma de pesos
        const finalScore = totalWeight > 0 ? (weightedScore / totalWeight) : 0;
        
        console.log('📊 Cálculo de score finalizado:', {
            evaluableCount,
            nonEvaluableCount,
            totalWeight: totalWeight.toFixed(2),
            weightedScore: weightedScore.toFixed(2),
            finalScore: finalScore.toFixed(2),
            originalScore: analysisResult.technicalAnalysis?.overallScore
        });

        // Guardar resultados en Firestore (mapeando correctamente desde technicalAnalysis, igual que startAnalysis)
        const adaptedAnalysisResult = {
            ...analysisResult,
            // Mapear correctamente los datos del technicalAnalysis
            detailedChecklist: analysisResult.technicalAnalysis?.parameters || [],
            analysisSummary: analysisResult.technicalAnalysis?.summary || 'Análisis completado',
            strengths: analysisResult.technicalAnalysis?.strengths || [],
            weaknesses: analysisResult.technicalAnalysis?.weaknesses || [],
            recommendations: analysisResult.technicalAnalysis?.recommendations || [],
            // ⚖️ Usar el score calculado con pesos personalizados
            score: Math.round(finalScore * 100) / 100,
            overallScore: Math.round(finalScore * 100) / 100,
            // Metadatos del cálculo de score
            scoreMetadata: {
                originalScore: analysisResult.technicalAnalysis?.overallScore || 0,
                weightedScore: Math.round(finalScore * 100) / 100,
                evaluableCount,
                nonEvaluableCount,
                totalWeight: Math.round(totalWeight * 100) / 100,
                shotTypeKey,
                calculatedAt: new Date().toISOString()
            }
        };

        // Limpiar valores undefined para Firestore
        const cleanForFirestore = (obj: any): any => {
            if (obj === null || obj === undefined) return null;
            if (Array.isArray(obj)) return obj.map(cleanForFirestore);
            if (typeof obj === 'object') {
                const cleaned: any = {};
                for (const [key, value] of Object.entries(obj)) {
                    if (value !== undefined) {
                        cleaned[key] = cleanForFirestore(value);
                    }
                }
                return cleaned;
            }
            return obj;
        };

        const cleanedResult = cleanForFirestore(adaptedAnalysisResult);

        console.log('🔍 Intentando guardar en Firestore...', {
            analysisId,
            hasAdminDb: !!adminDb,
            resultSize: JSON.stringify(cleanedResult).length
        });
        
        await adminDb.collection('analyses').doc(analysisId).update({
            status: 'analyzed',
            analysisResult: cleanedResult,
            updatedAt: new Date().toISOString()
        });

                // 🧠 KEYFRAMES INTELIGENTES (asíncrono, no bloquea)
                // Preparar buffers de video para keyframes (solo los que existen)
        const keyframeVideoBuffers = {
            back: videoFile1 ? videoBuffers[0] : undefined,
            front: videoFile2 ? videoBuffers[1] : undefined,
            left: videoFile3 ? videoBuffers[2] : undefined,
            right: videoFile4 ? videoBuffers[3] : undefined
        };
        
        // Verificar que al menos un video existe para keyframes
        const hasVideos = Object.values(keyframeVideoBuffers).some(buffer => buffer && buffer.length > 0);
        
        if (hasVideos) {
            // Extraer keyframes inteligentes de forma síncrona
                                    try {
                await extractAndUploadSmartKeyframesAsync({
                    analysisId,
                    videoBuffers: keyframeVideoBuffers,
                    userId
                });
                            } catch (err) {
                console.error('❌ [Smart Keyframes] Error en extracción:', err);
                // No fallar el análisis completo si fallan los keyframes
            }
        } else {
                                }

        return {
            success: true,
            message: "Análisis completado exitosamente con keyframes inteligentes.",
            analysisId: analysisId,
            redirectTo: `/analysis/${analysisId}`
        };

    } catch (error) {
        console.error('❌ Error en startAnalysisWithSmartKeyframes:', error);
        const message = error instanceof Error ? error.message : 'Error desconocido';
        return { message: `Error en el análisis: ${message}`, error: true };
    }
}
