'use client';

import { useState } from 'react';

export default function VerifyVideoDirectPage() {
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

      const response = await fetch('/api/verify-video-direct', {
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
            🔍 Verificación Directa de Video
          </h1>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              Esta página verifica si el modelo está viendo el video real o inventando datos.
            </p>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-red-900 mb-2">🚨 Objetivo de la Verificación:</h3>
              <ul className="list-disc list-inside text-red-800 space-y-1">
                <li><strong>Confirmar:</strong> Si el modelo ve el video real</li>
                <li><strong>Detectar:</strong> Si está inventando datos</li>
                <li><strong>Verificar:</strong> Elementos específicos del video</li>
                <li><strong>Identificar:</strong> Qué NO se ve en el video</li>
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
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
            />
          </div>

          <button
            onClick={handleVerify}
            disabled={!videoFile || isVerifying}
            className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isVerifying ? '🔍 Verificando...' : '🔍 Verificar Video Directo'}
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

              {/* Resultados de Verificación Directa */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3">
                  🔍 Resultados de Verificación Directa
                </h3>
                
                <div className="space-y-4">
                  {/* Respuesta Directa */}
                  <div className="bg-white rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 mb-2">📝 Respuesta Directa del Modelo</h4>
                    <p className="text-sm text-gray-700">{result.verification_result.respuesta_directa}</p>
                  </div>

                  {/* Confirmación de Video */}
                  <div className="bg-white rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 mb-2">✅ Confirma que Ve el Video</h4>
                    <div className="text-sm">
                      <span className="font-medium">Confirma video real:</span> 
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                        result.verification_result.confirma_video ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {result.verification_result.confirma_video ? 'Sí' : 'No'}
                      </span>
                    </div>
                  </div>

                  {/* Detalles Específicos */}
                  <div className="bg-white rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 mb-2">🔍 Detalles Específicos del Video</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {result.verification_result.detalles_especificos?.map((detail: string, index: number) => (
                        <li key={index}>{detail}</li>
                      )) || <li>No hay detalles específicos</li>}
                    </ul>
                  </div>

                  {/* Elementos Visibles */}
                  <div className="bg-white rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 mb-2">👁️ Elementos Visibles</h4>
                    <div className="text-sm">
                      <span className="font-medium">Elementos que se ven:</span> {result.verification_result.elementos_visibles?.join(', ') || 'No especificado'}
                    </div>
                  </div>

                  {/* Elementos NO Visibles */}
                  <div className="bg-white rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 mb-2">🚫 Elementos NO Visibles</h4>
                    <div className="text-sm">
                      <span className="font-medium">Elementos que NO se ven:</span> {result.verification_result.elementos_no_visibles?.join(', ') || 'No especificado'}
                    </div>
                  </div>

                  {/* Información Específica */}
                  <div className="bg-white rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 mb-2">📊 Información Específica</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Duración real:</span> {result.verification_result.duracion_real || 'No especificado'}
                      </div>
                      <div>
                        <span className="font-medium">Ángulo real:</span> {result.verification_result.angulo_real || 'No especificado'}
                      </div>
                      <div>
                        <span className="font-medium">Vestimenta real:</span> {result.verification_result.vestimenta_real || 'No especificado'}
                      </div>
                      <div>
                        <span className="font-medium">Canasta real:</span> {result.verification_result.canasta_real || 'No especificado'}
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium">Entorno real:</span> {result.verification_result.entorno_real || 'No especificado'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interpretación de Resultados */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 mb-3">📊 Interpretación de Resultados</h3>
                
                {result.verification_result?.confirma_video ? (
                  <div className="text-green-800">
                    <p className="font-medium">✅ Modelo Ve el Video Real</p>
                    <p>El modelo está analizando el video real con detalles específicos y precisos.</p>
                  </div>
                ) : (
                  <div className="text-red-800">
                    <p className="font-medium">❌ Modelo NO Ve el Video Real</p>
                    <p>El modelo está inventando datos en lugar de analizar el video real.</p>
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
