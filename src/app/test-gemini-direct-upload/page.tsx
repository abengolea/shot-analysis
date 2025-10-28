'use client';

import { useState } from 'react';

export default function TestGeminiDirectUploadPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isTesting, setIsTesting] = useState(false);
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

  const handleTest = async () => {
    if (!videoFile) {
      setError('Por favor selecciona un archivo de video');
      return;
    }

    setIsTesting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);

      const response = await fetch('/api/test-gemini-direct-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la prueba');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🎬 Prueba de Subida Directa a Gemini
          </h1>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              Esta página prueba la subida directa de video a Gemini para verificar si procesa el video real.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">🎯 Objetivo de la Prueba:</h3>
              <ul className="list-disc list-inside text-blue-800 space-y-1">
                <li><strong>Subir video directamente:</strong> Enviar el video como base64 a Gemini</li>
                <li><strong>Evitar URLs:</strong> No usar URLs de Firebase Storage</li>
                <li><strong>Verificar procesamiento:</strong> Confirmar que Gemini ve el video real</li>
                <li><strong>Detectar simulación:</strong> Identificar si deja de inventar datos</li>
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
            onClick={handleTest}
            disabled={!videoFile || isTesting}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isTesting ? '🎬 Probando...' : '🎬 Probar Subida Directa a Gemini'}
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
                <h3 className="font-semibold text-green-900 mb-2">✅ Prueba Completada</h3>
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
                  <div>
                    <span className="font-medium">Tamaño original:</span> {result.video_info.original_size} bytes
                  </div>
                  <div>
                    <span className="font-medium">Tamaño procesado:</span> {result.video_info.processed_size} bytes
                  </div>
                  <div>
                    <span className="font-medium">Tamaño base64:</span> {result.video_info.base64_size} caracteres
                  </div>
                  <div>
                    <span className="font-medium">MIME type:</span> {result.video_info.mime_type}
                  </div>
                </div>
              </div>

              {/* Respuesta de Gemini */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3">
                  🧠 Respuesta de Gemini
                </h3>
                
                {result.gemini_response?.candidates?.[0]?.content?.parts?.[0]?.text ? (
                  <div className="bg-white rounded-lg p-3">
                    <h4 className="font-medium text-gray-900 mb-2">📝 Descripción del Video</h4>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                      {result.gemini_response.candidates[0].content.parts[0].text}
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-yellow-800">⚠️ No se pudo extraer la descripción del video</p>
                  </div>
                )}

                {/* Metadatos de la respuesta */}
                <div className="bg-white rounded-lg p-3 mt-3">
                  <h4 className="font-medium text-gray-900 mb-2">📊 Metadatos de la Respuesta</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Modelo:</span> {result.gemini_response?.modelVersion || 'No especificado'}
                    </div>
                    <div>
                      <span className="font-medium">Finish reason:</span> {result.gemini_response?.candidates?.[0]?.finishReason || 'No especificado'}
                    </div>
                    <div>
                      <span className="font-medium">Tokens de prompt:</span> {result.gemini_response?.usageMetadata?.promptTokenCount || 'No especificado'}
                    </div>
                    <div>
                      <span className="font-medium">Tokens de respuesta:</span> {result.gemini_response?.usageMetadata?.candidatesTokenCount || 'No especificado'}
                    </div>
                    <div>
                      <span className="font-medium">Total tokens:</span> {result.gemini_response?.usageMetadata?.totalTokenCount || 'No especificado'}
                    </div>
                    <div>
                      <span className="font-medium">Response ID:</span> {result.gemini_response?.responseId || 'No especificado'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Análisis de la Respuesta */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 mb-3">📊 Análisis de la Respuesta</h3>
                
                {result.gemini_response?.candidates?.[0]?.content?.parts?.[0]?.text ? (
                  <div className="space-y-3">
                    <div className="bg-white rounded-lg p-3">
                      <h4 className="font-medium text-gray-900 mb-2">🔍 Indicadores de Procesamiento Real</h4>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        <li className={result.gemini_response.candidates[0].content.parts[0].text.includes('no visible') ? 'text-green-600' : 'text-red-600'}>
                          Contiene "no visible": {result.gemini_response.candidates[0].content.parts[0].text.includes('no visible') ? 'Sí' : 'No'}
                        </li>
                        <li className={result.gemini_response.candidates[0].content.parts[0].text.includes('baloncesto') ? 'text-green-600' : 'text-yellow-600'}>
                          Menciona "baloncesto": {result.gemini_response.candidates[0].content.parts[0].text.includes('baloncesto') ? 'Sí' : 'No'}
                        </li>
                        <li className={result.gemini_response.candidates[0].content.parts[0].text.includes('canasta') ? 'text-green-600' : 'text-yellow-600'}>
                          Menciona "canasta": {result.gemini_response.candidates[0].content.parts[0].text.includes('canasta') ? 'Sí' : 'No'}
                        </li>
                        <li className={result.gemini_response.candidates[0].content.parts[0].text.includes('jugador') ? 'text-green-600' : 'text-yellow-600'}>
                          Menciona "jugador": {result.gemini_response.candidates[0].content.parts[0].text.includes('jugador') ? 'Sí' : 'No'}
                        </li>
                      </ul>
                    </div>

                    <div className="bg-white rounded-lg p-3">
                      <h4 className="font-medium text-gray-900 mb-2">⚠️ Indicadores de Simulación</h4>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        <li className={result.gemini_response.candidates[0].content.parts[0].text.includes('pádel') ? 'text-red-600' : 'text-green-600'}>
                          Menciona "pádel": {result.gemini_response.candidates[0].content.parts[0].text.includes('pádel') ? 'Sí (PROBLEMA)' : 'No'}
                        </li>
                        <li className={result.gemini_response.candidates[0].content.parts[0].text.includes('tenis') ? 'text-red-600' : 'text-green-600'}>
                          Menciona "tenis": {result.gemini_response.candidates[0].content.parts[0].text.includes('tenis') ? 'Sí (PROBLEMA)' : 'No'}
                        </li>
                        <li className={result.gemini_response.candidates[0].content.parts[0].text.includes('gimnasio') ? 'text-yellow-600' : 'text-green-600'}>
                          Menciona "gimnasio": {result.gemini_response.candidates[0].content.parts[0].text.includes('gimnasio') ? 'Sí (POSIBLE SIMULACIÓN)' : 'No'}
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-red-800">
                    <p className="font-medium">❌ No se pudo analizar la respuesta</p>
                    <p>La respuesta de Gemini no contiene texto válido.</p>
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





