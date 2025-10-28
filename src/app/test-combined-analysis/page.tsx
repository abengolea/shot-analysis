'use client';

import { useState } from 'react';

export default function TestCombinedAnalysisPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setResult(null);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!videoFile) {
      setError('Por favor selecciona un archivo de video');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);

      const response = await fetch('/api/test-combined-analysis', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en el análisis');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🎯 Análisis Combinado: Detección + Técnica
          </h1>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              Esta página combina tu prompt especializado para detectar lanzamientos con el prompt existente para análisis técnico.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">🔍 Proceso de Análisis:</h3>
              <ol className="list-decimal list-inside text-blue-800 space-y-1">
                <li><strong>Detección de Lanzamientos:</strong> Usa tu prompt especializado para identificar cada tiro individual</li>
                <li><strong>Análisis Técnico:</strong> Usa el prompt existente para evaluar los 22 parámetros canónicos</li>
                <li><strong>Resultados Combinados:</strong> Muestra ambos análisis en una respuesta unificada</li>
              </ol>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Video de Baloncesto
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!videoFile || isAnalyzing}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzing ? '🔄 Analizando...' : '🎯 Iniciar Análisis Combinado'}
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

              {/* Información del Video */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">📹 Información del Video</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Nombre:</span> {result.video_info.original_name}
                  </div>
                  <div>
                    <span className="font-medium">Duración:</span> {result.video_info.duration}
                  </div>
                  <div>
                    <span className="font-medium">FPS:</span> {result.video_info.fps}
                  </div>
                  <div>
                    <span className="font-medium">Resolución:</span> {result.video_info.resolution}
                  </div>
                </div>
              </div>

              {/* Detección de Lanzamientos */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3">
                  🎯 Detección de Lanzamientos ({result.shot_detection.total_shots} tiros detectados)
                </h3>
                
                {result.shot_detection.shots.map((shot: any, index: number) => (
                  <div key={index} className="bg-white rounded-lg p-3 mb-3">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">Tiro #{shot.id}</h4>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        shot.confidence > 0.8 ? 'bg-green-100 text-green-800' :
                        shot.confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        Confianza: {(shot.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Inicio:</span> {shot.start_time}
                      </div>
                      <div>
                        <span className="font-medium">Liberación:</span> {shot.release_time}
                      </div>
                      <div>
                        <span className="font-medium">Fin:</span> {shot.end_time}
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mt-2">
                      <span className="font-medium">Duración:</span> {shot.duration}
                    </div>
                    
                    {shot.estimated && (
                      <div className="text-xs text-orange-600 mt-1">
                        ⚠️ Tiempos estimados (balón no visible)
                      </div>
                    )}
                    
                    {shot.notes && shot.notes.length > 0 && (
                      <div className="text-xs text-gray-500 mt-2">
                        <span className="font-medium">Notas:</span> {shot.notes.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
                
                <div className="bg-white rounded-lg p-3 mt-3">
                  <h4 className="font-medium text-gray-900 mb-2">📊 Diagnósticos</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>FPS Asumido: {result.shot_detection.diagnostics.fps_assumed || 'N/A'}</div>
                    <div>Frames Totales: {result.shot_detection.diagnostics.frames_total || 'N/A'}</div>
                    <div>Segmentos Rechazados: {result.shot_detection.diagnostics.rejected_segments}</div>
                  </div>
                </div>
              </div>

              {/* Análisis Técnico */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 mb-3">🔍 Análisis Técnico</h3>
                
                <div className="bg-white rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">📋 Verificación Inicial</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Duración:</span> {result.technical_analysis.verificacion_inicial.duracion_video}
                    </div>
                    <div>
                      <span className="font-medium">Mano de tiro:</span> {result.technical_analysis.verificacion_inicial.mano_tiro}
                    </div>
                    <div>
                      <span className="font-medium">Salta:</span> {result.technical_analysis.verificacion_inicial.salta ? 'Sí' : 'No'}
                    </div>
                    <div>
                      <span className="font-medium">Canasta visible:</span> {result.technical_analysis.verificacion_inicial.canasta_visible ? 'Sí' : 'No'}
                    </div>
                    <div>
                      <span className="font-medium">Ángulo cámara:</span> {result.technical_analysis.verificacion_inicial.angulo_camara}
                    </div>
                    <div>
                      <span className="font-medium">Elementos entorno:</span> {result.technical_analysis.verificacion_inicial.elementos_entorno.join(', ')}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">📊 Resumen de Evaluación</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Parámetros evaluados:</span> {result.technical_analysis.resumen_evaluacion.parametros_evaluados}
                    </div>
                    <div>
                      <span className="font-medium">No evaluables:</span> {result.technical_analysis.resumen_evaluacion.parametros_no_evaluables}
                    </div>
                    <div>
                      <span className="font-medium">Score global:</span> {result.technical_analysis.resumen_evaluacion.score_global}
                    </div>
                    <div>
                      <span className="font-medium">Confianza:</span> {result.technical_analysis.resumen_evaluacion.confianza_analisis}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">💪 Fortalezas y Debilidades</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium text-green-700">Fortalezas:</span>
                      <ul className="list-disc list-inside text-sm text-gray-600 ml-2">
                        {result.technical_analysis.strengths.map((strength: string, index: number) => (
                          <li key={index}>{strength}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-medium text-red-700">Debilidades:</span>
                      <ul className="list-disc list-inside text-sm text-gray-600 ml-2">
                        {result.technical_analysis.weaknesses.map((weakness: string, index: number) => (
                          <li key={index}>{weakness}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Características Únicas */}
              <div className="bg-yellow-50 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 mb-3">🔍 Características Únicas del Video</h3>
                <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                  {result.technical_analysis.caracteristicas_unicas.map((characteristic: string, index: number) => (
                    <li key={index}>{characteristic}</li>
                  ))}
                </ul>
              </div>

              {/* Tiempo de Procesamiento */}
              <div className="text-center text-sm text-gray-500">
                Procesado el: {new Date(result.processing_time).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




