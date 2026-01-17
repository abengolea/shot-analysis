'use client';

import { useState, useRef, useEffect } from 'react';
import Timeline from '@/components/Timeline';
import AnchoredCommentsOverlay from '@/components/AnchoredCommentsOverlay';
import { Timeline as TimelineType } from '@/lib/timeline-types';

export default function TestBiomechanicalTransferPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineType | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const analyzeLock = useRef(false); // Lock para evitar carreras
  const [cameraHint, setCameraHint] = useState<'auto' | 'frontal' | 'lateral'>('auto');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setResult(null);
      setError(null);
    }
  };

  // Funciones helper para merge inteligente
  const prefer = (a?: string[], b?: string[]): string[] => {
    return (b && b.length > 0) ? b : (a ?? []);
  };

  const mergeSequence = (prev: any[] | null | undefined, next: any[] | null | undefined): any[] => {
    const index = (arr: any[]) => Object.fromEntries(arr.map((s) => [s.segment?.toLowerCase(), s]));
    const p = index(prev ?? []);
    const n = index(next ?? []);
    const expected = ['piernas', 'cadera', 'tronco', 'brazo', 'muñeca', 'dedos'];
    
    return expected.map(seg => {
      const lo = seg.toLowerCase();
      // Preferir nuevo si no es "no_detectado", sino mantener anterior, sino usar nuevo o crear placeholder
      if (n[lo] && n[lo].status !== 'no_detectado') {
        return n[lo];
      } else if (p[lo] && p[lo].status !== 'no_detectado') {
        return p[lo];
      } else {
        return n[lo] ?? p[lo] ?? { segment: seg, status: 'no_detectado', order: expected.indexOf(seg) + 1 };
      }
    });
  };

  const handleAnalyze = async () => {
    if (!videoFile) {
      setError('Por favor selecciona un archivo de video');
      return;
    }

    // Lock para evitar carreras
    if (analyzeLock.current) {
      console.warn('⚠️ Análisis ya en progreso, ignorando solicitud duplicada');
      return;
    }

    analyzeLock.current = true;
    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('camera_hint', cameraHint);

      const response = await fetch('/api/test-biomechanical-transfer', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en el análisis');
      }

      // Merge inteligente: preferir último no vacío
      setResult((prev: any) => {
        if (!prev) {
          return data; // Primera vez, usar directamente
        }

        // Merge por partes
        return {
          ...prev,
          ...data, // Sobrescribir campos simples
          efficiency_index: data.efficiency_index ?? prev.efficiency_index,
          activation_sequence: mergeSequence(prev.activation_sequence, data.activation_sequence),
          timing_analysis: data.timing_analysis ?? prev.timing_analysis,
          feedback: {
            errors: prefer(prev.feedback?.errors, data.feedback?.errors),
            recommendations: prefer(prev.feedback?.recommendations, data.feedback?.recommendations),
            strengths: prefer(prev.feedback?.strengths, data.feedback?.strengths),
            coachMessages: prefer(prev.feedback?.coachMessages, data.feedback?.coachMessages),
          },
          metrics: { ...prev.metrics, ...data.metrics },
          video_info: data.video_info ?? prev.video_info,
          analysisId: data.analysisId ?? prev.analysisId,
          timeline: data.timeline ?? prev.timeline,
        };
      });
      
      // Cargar timeline si está disponible
      if (data.timeline && data.analysisId) {
        try {
          const timelineRes = await fetch(`/api/test-biomechanical-transfer/${data.analysisId}/comments`);
          if (timelineRes.ok) {
            const timelineData = await timelineRes.json();
            if (timelineData.timeline) {
              setTimeline(timelineData.timeline);
            }
          }
        } catch (timelineError) {
          console.warn('Error cargando timeline:', timelineError);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setIsAnalyzing(false);
      analyzeLock.current = false;
    }
  };

  const handleSeek = (tMs: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = tMs / 1000;
    }
  };

  const handleAddComment = (tMs: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = tMs / 1000;
    }
  };

  // Actualizar tiempo actual del video para el overlay
  useEffect(() => {
    if (!videoRef.current) return;

    const updateTime = () => {
      if (videoRef.current) {
        setCurrentTimeMs(Math.round(videoRef.current.currentTime * 1000));
      }
    };

    videoRef.current.addEventListener('timeupdate', updateTime);
    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('timeupdate', updateTime);
      }
    };
  }, [videoRef, result?.video_info?.video_url]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🏀 Análisis Biomecánico: Transferencia Energética
          </h1>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              Sistema especializado en evaluar la <strong>transferencia energética</strong> en el tiro de baloncesto:
              <strong className="text-blue-600"> piernas → cadera → tronco → brazo → muñeca → dedos</strong>
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">🔍 Parámetros Evaluados:</h3>
              <ul className="list-disc list-inside text-blue-800 space-y-1">
                <li><strong>Orden de activación:</strong> Secuencia proximal → distal correcta</li>
                <li><strong>Timing:</strong> Momento exacto de activación de cada segmento</li>
                <li><strong>Ritmo y fluidez:</strong> Suavidad del movimiento sin quiebres</li>
                <li><strong>Pérdidas de energía:</strong> Detección de "fugas" en la cadena cinética</li>
                <li><strong>Set-point:</strong> Posición y momento óptimo del punto de carga</li>
                <li><strong>Momento de liberación:</strong> Timing biomecánicamente ideal</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Errores Comunes Detectados:</h3>
              <ul className="list-disc list-inside text-yellow-800 space-y-1 text-sm">
                <li>Brazos anticipados (se adelantan antes de las piernas)</li>
                <li>Liberación tardía (después de completar la extensión)</li>
                <li>Falta de uso de la cadera (tiro solo de brazo)</li>
                <li>Set-point bajo/alto (posición incorrecta)</li>
                <li>Movimiento brusco (quiebres en la cadena)</li>
                <li>Falta de transferencia desde piernas</li>
              </ul>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Video de Tiro de Baloncesto
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">🎥 Orientación de cámara (opcional)</h3>
            <p className="text-xs text-gray-600 mb-3">
              Si sabés que el video es vista lateral o frontal podés forzarlo. Por defecto el sistema detecta automáticamente.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'auto', label: 'Auto (detecta solo)', emoji: '🤖' },
                { value: 'lateral', label: 'Forzar lateral', emoji: '📐' },
                { value: 'frontal', label: 'Forzar frontal', emoji: '🎯' },
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCameraHint(option.value as 'auto' | 'lateral' | 'frontal')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    cameraHint === option.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  <span className="mr-1">{option.emoji}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!videoFile || isAnalyzing}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzing ? '🔄 Analizando transferencia energética...' : '🎯 Iniciar Análisis Biomecánico'}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-semibold">❌ Error:</p>
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">✅ Análisis Completado</h3>
                <p className="text-green-800">{result.message}</p>
              </div>

              {/* Índice de Eficiencia */}
              {result.efficiency_index !== undefined && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-3">📊 Índice de Eficiencia de Transferencia</h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Eficiencia</span>
                        <span className="text-sm font-bold text-blue-600">{result.efficiency_index}/100</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4">
                        <div
                          className={`h-4 rounded-full ${
                            result.efficiency_index >= 80 ? 'bg-green-500' :
                            result.efficiency_index >= 60 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${result.efficiency_index}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {result.efficiency_index >= 80 ? 'Excelente transferencia energética' :
                     result.efficiency_index >= 60 ? 'Transferencia aceptable con mejoras' :
                     'Transferencia deficiente - requiere corrección'}
                  </p>
                </div>
              )}

              {/* Descripción Visual del Video - Cuadro de Verificación */}
              {result.video_description && !result.video_description.disabled && (
                <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">👁️</span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                        🔍 Verificación: ¿Qué ve la IA del video?
                        {result.video_description.isRealVideo && (
                          <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                            ✓ Video Real
                          </span>
                        )}
                      </h4>
                      
                      {/* Descripción principal */}
                      <p className="text-sm text-blue-800 mb-3 bg-white p-3 rounded border border-blue-200">
                        {result.video_description.description}
                      </p>
                      
                      {/* Detalles específicos */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-white p-2 rounded border border-blue-200">
                          <span className="font-medium text-blue-900">🏀 Aro visible:</span>
                          <span className={`ml-2 ${result.video_description.details.aroVisible ? 'text-green-700 font-semibold' : 'text-red-700'}`}>
                            {result.video_description.details.aroVisible ? 'Sí ✓' : 'No ✗'}
                          </span>
                        </div>
                        
                        {result.video_description.details.colorRemera && (
                          <div className="bg-white p-2 rounded border border-blue-200">
                            <span className="font-medium text-blue-900">👕 Remera:</span>
                            <span className="ml-2 text-blue-700">{result.video_description.details.colorRemera}</span>
                          </div>
                        )}
                        
                        {result.video_description.details.colorPantalon && (
                          <div className="bg-white p-2 rounded border border-blue-200">
                            <span className="font-medium text-blue-900">👖 Pantalón:</span>
                            <span className="ml-2 text-blue-700">{result.video_description.details.colorPantalon}</span>
                          </div>
                        )}
                        
                        <div className="bg-white p-2 rounded border border-blue-200">
                          <span className="font-medium text-blue-900">🏟️ Entorno:</span>
                          <span className="ml-2 text-blue-700 capitalize">{result.video_description.details.entorno}</span>
                        </div>
                        
                        {result.video_description.details.iluminacion && (
                          <div className="bg-white p-2 rounded border border-blue-200">
                            <span className="font-medium text-blue-900">💡 Iluminación:</span>
                            <span className="ml-2 text-blue-700 capitalize">{result.video_description.details.iluminacion}</span>
                          </div>
                        )}
                        
                        {result.video_description.details.calidadVideo && (
                          <div className="bg-white p-2 rounded border border-blue-200">
                            <span className="font-medium text-blue-900">📹 Calidad:</span>
                            <span className="ml-2 text-blue-700 capitalize">{result.video_description.details.calidadVideo}</span>
                          </div>
                        )}
                      </div>
                      
                      {result.video_description.details.otrosDetalles && (
                        <div className="mt-3 bg-white p-2 rounded border border-blue-200">
                          <span className="font-medium text-blue-900 text-sm">📌 Otros detalles:</span>
                          <p className="text-sm text-blue-700 mt-1">{result.video_description.details.otrosDetalles}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {result.video_description?.disabled && (
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">⏸️</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800 mb-2">Verificación visual temporalmente deshabilitada</h3>
                      <p className="text-sm text-gray-700">
                        {result.video_description.description || 'Estamos actualizando el verificador visual. Volvé a intentarlo más tarde.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Banner de análisis incompleto (gobernado por regla de honestidad) */}
              {result.analysis_summary && result.analysis_summary.analysis_complete === false && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">🚧</span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900 mb-1">Análisis incompleto</h4>
                      <p className="text-sm text-red-800">
                        {result.analysis_summary.banner || 'Análisis incompleto: datos insuficientes para cadena cinética.'}
                      </p>
                      <p className="text-xs text-red-700 mt-2">
                        Segmentos detectados: {result.analysis_summary.segments_detected ?? 0} de 6.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Advertencia/Banner de orientación de cámara */}
              {result.camera_orientation && result.camera_orientation.confidence_score >= 0.8 && (
                result.camera_orientation.orientation === 'frontal' ? (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
                    <div className="flex items-start">
                      <span className="text-2xl mr-3">⚠️</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-yellow-900 mb-1">Vista Frontal Detectada</h4>
                        <p className="text-sm text-yellow-800 mb-2">
                          {result.camera_orientation.reasoning}
                          {result.camera_orientation.confidence === 'low' && ' (baja confianza)'}
                        </p>
                        <p className="text-sm text-yellow-700">
                          <strong>Recomendación:</strong> Para análisis completo de cadena cinética (cadera-tronco-brazo-muñeca), 
                          recomendamos subir un video de <strong>perfil (vista lateral)</strong>.
                        </p>
                        <p className="text-xs text-yellow-600 mt-2 italic">
                          La vista frontal es ideal para analizar set-point y liberación, pero limita la detección de la secuencia de activación.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : result.camera_orientation.orientation === 'lateral' ? (
                  <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-4">
                    <div className="flex items-start">
                      <span className="text-2xl mr-3">✅</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-green-900 mb-1">Vista Lateral Detectada</h4>
                        <p className="text-sm text-green-800 mb-2">
                          {result.camera_orientation.reasoning}
                          {result.camera_orientation.confidence === 'high' && ' ✓ Alta confianza'}
                        </p>
                        <p className="text-sm text-green-700">
                          <strong>Perfecto:</strong> La vista lateral permite análisis completo de la cadena cinética 
                          (piernas → cadera → tronco → brazo → muñeca).
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4">
                    <div className="flex items-start">
                      <span className="text-2xl mr-3">❓</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">Orientación No Determinada</h4>
                        <p className="text-sm text-gray-800 mb-2">
                          {result.camera_orientation.reasoning}
                        </p>
                        <p className="text-sm text-gray-700">
                          El análisis se realizará con los datos disponibles, pero puede ser parcial.
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Secuencia de Activación - Siempre mostrar 6 segmentos */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">⚡ Secuencia de Activación Proximal → Distal</h3>
                <div className="space-y-3">
                  {(result.activation_sequence || [
                    { segment: 'piernas', name: 'Piernas', status: 'no_detectado', order: 1 },
                    { segment: 'cadera', name: 'Cadera', status: 'no_detectado', order: 2 },
                    { segment: 'tronco', name: 'Tronco', status: 'no_detectado', order: 3 },
                    { segment: 'brazo', name: 'Brazo', status: 'no_detectado', order: 4 },
                    { segment: 'muñeca', name: 'Muñeca', status: 'no_detectado', order: 5 },
                    { segment: 'dedos', name: 'Dedos', status: 'no_detectado', order: 6 },
                  ]).map((segment: any, index: number) => {
                    const isNoDetectado = segment.status === 'no_detectado';
                    return (
                      <div key={segment.segment || index} className={`bg-white rounded-lg p-3 border ${isNoDetectado ? 'border-gray-300 border-dashed opacity-75' : 'border-gray-200'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center space-x-2">
                            <span className={`flex items-center justify-center w-6 h-6 rounded-full font-bold text-sm ${
                              isNoDetectado ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {segment.order || index + 1}
                            </span>
                            <span className="font-medium text-gray-900 capitalize">{segment.name || segment.segment}</span>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            segment.status === 'correcto' ? 'bg-green-100 text-green-800' :
                            segment.status === 'mejorable' ? 'bg-yellow-100 text-yellow-800' :
                            segment.status === 'incorrecto' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {isNoDetectado ? 'No detectado' : segment.status}
                          </span>
                        </div>
                        {!isNoDetectado ? (
                          <div className="text-sm text-gray-600 space-y-1 ml-8">
                            {segment.activation_time && (
                              <div><span className="font-medium">Tiempo de activación:</span> {segment.activation_time} {segment.activation_time_ms !== null && segment.activation_time_ms !== undefined && `(${segment.activation_time_ms}ms desde inicio)`}</div>
                            )}
                            {segment.peak_velocity_ms !== undefined && segment.peak_velocity_ms !== null && (
                              <div><span className="font-medium">Pico de velocidad:</span> {segment.peak_velocity_ms}ms</div>
                            )}
                            {segment.delay_ms !== undefined && segment.delay_ms !== null && segment.delay_ms > 0 && (
                              <div className="text-orange-600">
                                <span className="font-medium">Retraso detectado:</span> {segment.delay_ms}ms
                              </div>
                            )}
                            {segment.delay_ms !== undefined && segment.delay_ms !== null && segment.delay_ms < 0 && (
                              <div className="text-red-600">
                                <span className="font-medium">⚠️ Anticipado:</span> {Math.abs(segment.delay_ms)}ms antes de lo esperado
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic ml-8">
                            No se detectó activación clara de este segmento en esta corrida.
                            {result.camera_orientation?.confidence_score >= 0.8 && result.camera_orientation?.orientation === 'frontal' && 
                             ['cadera', 'tronco', 'brazo'].includes(segment.segment?.toLowerCase() || '') && (
                              <span className="block mt-1 text-xs text-yellow-600">
                                💡 La vista frontal dificulta la detección de este segmento. Intenta con video lateral.
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Timing y Set-Point */}
              {result.timing_analysis && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-900 mb-3">⏱️ Análisis de Timing y Set-Point</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3">
                      <h4 className="font-medium text-gray-900 mb-2">Set-Point</h4>
                      <div className="text-sm space-y-1">
                        <div><span className="font-medium">Posición:</span> {result.timing_analysis.set_point.position}</div>
                        <div><span className="font-medium">Momento:</span> {result.timing_analysis.set_point.timestamp}</div>
                        {result.timing_analysis.set_point.timestamp_ms !== undefined && (
                          <div className="text-xs text-gray-500">{result.timing_analysis.set_point.timestamp_ms}ms desde inicio</div>
                        )}
                        <div><span className="font-medium">Altura:</span> {result.timing_analysis.set_point.height}</div>
                        <div className={`mt-2 px-2 py-1 rounded text-xs font-medium inline-block ${
                          result.timing_analysis.set_point.status === 'correcto' ? 'bg-green-100 text-green-800' :
                          result.timing_analysis.set_point.status === 'mejorable' ? 'bg-yellow-100 text-yellow-800' :
                          result.timing_analysis.set_point.status.startsWith('estimado') ? 'bg-gray-100 text-gray-700' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {result.timing_analysis.set_point.status}
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <h4 className="font-medium text-gray-900 mb-2">Liberación</h4>
                      <div className="text-sm space-y-1">
                        <div><span className="font-medium">Momento:</span> {result.timing_analysis.release.timestamp}</div>
                        {result.timing_analysis.release.timestamp_ms !== undefined && (
                          <div className="text-xs text-gray-500">{result.timing_analysis.release.timestamp_ms}ms desde inicio</div>
                        )}
                        <div><span className="font-medium">Timing:</span> {result.timing_analysis.release.timing}</div>
                        <div className={`mt-2 px-2 py-1 rounded text-xs font-medium inline-block ${
                          result.timing_analysis.release.status === 'correcto' ? 'bg-green-100 text-green-800' :
                          result.timing_analysis.release.status === 'mejorable' ? 'bg-yellow-100 text-yellow-800' :
                          result.timing_analysis.release.status.startsWith('estimado') ? 'bg-gray-100 text-gray-700' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {result.timing_analysis.release.status}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Feedback Técnico */}
              {result.feedback && (
                <div className="bg-orange-50 rounded-lg p-4">
                  <h3 className="font-semibold text-orange-900 mb-3">💬 Feedback Técnico Automático</h3>
                  
                  {result.feedback.errors && result.feedback.errors.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-red-800 mb-2">❌ Errores Detectados:</h4>
                      <ul className="list-disc list-inside space-y-2 text-sm text-red-700">
                        {result.feedback.errors.map((error: string, index: number) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.feedback.recommendations && result.feedback.recommendations.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-blue-800 mb-2">💡 Recomendaciones:</h4>
                      <ul className="list-disc list-inside space-y-2 text-sm text-blue-700">
                        {result.feedback.recommendations.map((rec: string, index: number) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.feedback.strengths && result.feedback.strengths.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-green-800 mb-2">✅ Fortalezas:</h4>
                      <ul className="list-disc list-inside space-y-2 text-sm text-green-700">
                        {result.feedback.strengths.map((strength: string, index: number) => (
                          <li key={index}>{strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.feedback.coachMessages && result.feedback.coachMessages.length > 0 && (
                    <div>
                      <h4 className="font-medium text-purple-800 mb-2">📢 Mensajes de Coaching:</h4>
                      <ul className="list-disc list-inside space-y-2 text-sm text-purple-700">
                        {result.feedback.coachMessages.map((message: string, index: number) => (
                          <li key={index}>{message}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.labels && result.labels.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium text-gray-700 mb-2">🏷️ Etiquetas:</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.labels.map((label: string, index: number) => (
                          <span key={index} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Debug: Mostrar estructura completa del feedback si está vacío */}
                  {(!result.feedback.errors || result.feedback.errors.length === 0) &&
                   (!result.feedback.recommendations || result.feedback.recommendations.length === 0) &&
                   (!result.feedback.strengths || result.feedback.strengths.length === 0) &&
                   (!result.feedback.coachMessages || result.feedback.coachMessages.length === 0) && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-800">
                        ⚠️ No se generó feedback técnico. Esto puede deberse a un error en el análisis de IA.
                      </p>
                      {process.env.NODE_ENV === 'development' && (
                        <details className="mt-2">
                          <summary className="text-xs text-yellow-700 cursor-pointer">Ver datos de feedback (debug)</summary>
                          <pre className="text-xs mt-2 overflow-auto max-h-40 bg-white p-2 rounded border">
                            {JSON.stringify(result.feedback, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Métricas Detalladas */}
              {result.metrics && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">📐 Métricas Biomecánicas</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {result.metrics.fluidity_score != null && (
                      <div className="bg-white rounded-lg p-3">
                        <div className="font-medium text-gray-700 mb-1">Índice de Fluidez</div>
                        <div className="text-2xl font-bold text-blue-600">{result.metrics.fluidity_score}/100</div>
                      </div>
                    )}
                    {result.metrics.energy_loss != null && (
                      <div className="bg-white rounded-lg p-3">
                        <div className="font-medium text-gray-700 mb-1">Pérdidas de Energía</div>
                        <div className="text-2xl font-bold text-red-600">{result.metrics.energy_loss}%</div>
                      </div>
                    )}
                    {result.metrics.set_point_score !== undefined && (
                      <div className="bg-white rounded-lg p-3">
                        <div className="font-medium text-gray-700 mb-1">Set-Point Score</div>
                        <div className="text-2xl font-bold text-purple-600">{result.metrics.set_point_score}/100</div>
                      </div>
                    )}
                    {result.metrics.sequence_delay_ms !== undefined && (
                      <div className="bg-white rounded-lg p-3">
                        <div className="font-medium text-gray-700 mb-1">Retraso en Secuencia</div>
                        <div className="text-2xl font-bold text-orange-600">{result.metrics.sequence_delay_ms}ms</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reproductor de Video */}
              {result.video_info?.video_url && (
                <div className="bg-gray-50 rounded-lg p-4 relative">
                  <h3 className="font-semibold text-gray-900 mb-3">📹 Video Procesado</h3>
                  <div className="relative">
                    <video
                      ref={videoRef}
                      src={result.video_info.video_url}
                      controls
                      className="w-full rounded-lg"
                    />
                    {/* Overlay de comentarios anclados - posicionado sobre el video */}
                    {timeline && (
                      <div className="absolute inset-0 pointer-events-none">
                        <AnchoredCommentsOverlay
                          videoRef={videoRef}
                          keyframes={timeline.keyframes}
                          currentTimeMs={currentTimeMs}
                          tolerance={250}
                        />
                      </div>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div><span className="font-medium">Nombre:</span> {result.video_info.original_name}</div>
                    <div><span className="font-medium">Duración:</span> {result.video_info.duration}</div>
                    <div><span className="font-medium">FPS:</span> {result.video_info.fps}</div>
                    <div><span className="font-medium">Resolución:</span> {result.video_info.resolution}</div>
                  </div>
                </div>
              )}

              {/* Timeline con Comentarios */}
              {timeline && result.analysisId && (
                <Timeline
                  timeline={timeline}
                  videoRef={videoRef}
                  onSeek={handleSeek}
                  onAddComment={handleAddComment}
                  analysisId={result.analysisId}
                />
              )}

              {/* Tiempo de Procesamiento */}
              {result.processing_time && (
                <div className="text-center text-sm text-gray-500">
                  Procesado el: {new Date(result.processing_time).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

