'use client';

import { useState } from 'react';

export default function VerifyVideoAnalysisPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
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

  const handleVerify = async () => {
    if (!videoFile) {
      setError('Por favor selecciona un archivo de video');
      return;
    }

    setIsVerifying(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);

      const response = await fetch('/api/verify-video-analysis', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la verificación');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🔍 Verificación de Análisis de Video
          </h1>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              Esta página verifica si el modelo está analizando el video real o simulando datos.
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-yellow-900 mb-2">🎯 Objetivo de la Verificación:</h3>
              <ul className="list-disc list-inside text-yellow-800 space-y-1">
                <li><strong>Vestimenta:</strong> Color exacto de camiseta y pantalón</li>
                <li><strong>Ángulo:</strong> Posición de la cámara (frontal, lateral, etc.)</li>
                <li><strong>Canasta:</strong> Si se ve la canasta, aro o tablero</li>
                <li><strong>Resultados:</strong> Número real de encestes y fallos observados</li>
                <li><strong>Detalles únicos:</strong> Características específicas del video</li>
              </ul>
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
            onClick={handleVerify}
            disabled={!videoFile || isVerifying}
            className="w-full bg-yellow-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isVerifying ? '🔍 Verificando...' : '🔍 Verificar Análisis de Video'}
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
                <h3 className="font-semibold text-green-900 mb-2">✅ Verificación Completada</h3>
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

              {/* Resultados de Verificación */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3">
                  🔍 Resultados de Verificación
                </h3>
                
                <div className="space-y-4">
                  {/* Vestimenta */}
                  <div className="bg-white rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 mb-2">👕 Vestimenta del Jugador</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Camiseta:</span> {result.verification_result.verificacion_basica.color_camiseta}
                      </div>
                      <div>
                        <span className="font-medium">Pantalón:</span> {result.verification_result.verificacion_basica.color_pantalon}
                      </div>
                    </div>
                  </div>

                  {/* Ángulo y Visibilidad */}
                  <div className="bg-white rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 mb-2">📹 Ángulo y Visibilidad</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Ángulo cámara:</span> {result.verification_result.verificacion_basica.angulo_camara}
                      </div>
                      <div>
                        <span className="font-medium">Duración:</span> {result.verification_result.verificacion_basica.duracion_video}
                      </div>
                      <div>
                        <span className="font-medium">Canasta visible:</span> {result.verification_result.verificacion_basica.canasta_visible ? 'Sí' : 'No'}
                      </div>
                      <div>
                        <span className="font-medium">Aro visible:</span> {result.verification_result.verificacion_basica.aro_visible ? 'Sí' : 'No'}
                      </div>
                      <div>
                        <span className="font-medium">Tablero visible:</span> {result.verification_result.verificacion_basica.tablero_visible ? 'Sí' : 'No'}
                      </div>
                    </div>
                  </div>

                  {/* Resultados de Tiros */}
                  <div className="bg-white rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 mb-2">🏀 Resultados de Tiros</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Encestes:</span> {result.verification_result.verificacion_basica.encestes_observados}
                      </div>
                      <div>
                        <span className="font-medium">Fallidos:</span> {result.verification_result.verificacion_basica.tiros_fallidos}
                      </div>
                      <div>
                        <span className="font-medium">Total:</span> {result.verification_result.verificacion_basica.total_tiros}
                      </div>
                    </div>
                  </div>

                  {/* Elementos del Entorno */}
                  <div className="bg-white rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 mb-2">🌍 Elementos del Entorno</h4>
                    <div className="text-sm">
                      <span className="font-medium">Elementos visibles:</span> {result.verification_result.verificacion_basica.elementos_entorno.join(', ')}
                    </div>
                  </div>

                  {/* Detalles Específicos */}
                  <div className="bg-white rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 mb-2">🔍 Detalles Específicos del Video</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {result.verification_result.verificacion_basica.detalles_especificos.map((detail: string, index: number) => (
                        <li key={index}>{detail}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Confianza y Advertencias */}
                  <div className="bg-white rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 mb-2">⚠️ Confianza y Advertencias</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">Confianza del análisis:</span> 
                        <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                          result.verification_result.confianza_analisis === 'alta' ? 'bg-green-100 text-green-800' :
                          result.verification_result.confianza_analisis === 'media' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {result.verification_result.confianza_analisis}
                        </span>
                      </div>
                      {result.verification_result.advertencias.length > 0 && (
                        <div>
                          <span className="font-medium">Advertencias:</span>
                          <ul className="list-disc list-inside text-sm mt-1">
                            {result.verification_result.advertencias.map((warning: string, index: number) => (
                              <li key={index} className="text-orange-600">{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Interpretación de Resultados */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 mb-3">📊 Interpretación de Resultados</h3>
                
                {result.verification_result.confianza_analisis === 'alta' ? (
                  <div className="text-green-800">
                    <p className="font-medium">✅ Análisis Confiable</p>
                    <p>El modelo está analizando el video real con detalles específicos y precisos.</p>
                  </div>
                ) : result.verification_result.confianza_analisis === 'media' ? (
                  <div className="text-yellow-800">
                    <p className="font-medium">⚠️ Análisis Parcialmente Confiable</p>
                    <p>El modelo está analizando el video pero con algunas limitaciones o incertidumbres.</p>
                  </div>
                ) : (
                  <div className="text-red-800">
                    <p className="font-medium">❌ Análisis No Confiable</p>
                    <p>El modelo puede estar simulando datos en lugar de analizar el video real.</p>
                  </div>
                )}
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




