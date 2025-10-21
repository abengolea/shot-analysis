'use client';

import { useState } from 'react';

export default function SaveVideoAnalysisPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [userId, setUserId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
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

  const handleSave = async () => {
    if (!videoFile) {
      setError('Por favor selecciona un archivo de video');
      return;
    }

    if (!userId) {
      setError('Por favor ingresa un User ID');
      return;
    }

    setIsSaving(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('userId', userId);
      if (playerId) formData.append('playerId', playerId);
      if (playerName) formData.append('playerName', playerName);

      const response = await fetch('/api/save-video-analysis', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error guardando análisis');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            💾 Guardar Análisis en Historial
          </h1>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              Sube un video de baloncesto para analizarlo y guardarlo en el historial.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">💾 Funcionalidades:</h3>
              <ul className="list-disc list-inside text-blue-800 space-y-1">
                <li><strong>Análisis con Gemini:</strong> Procesa el video directamente</li>
                <li><strong>Almacenamiento:</strong> Guarda video en Firebase Storage</li>
                <li><strong>Historial:</strong> Guarda análisis en Firestore</li>
                <li><strong>Organización:</strong> Asocia con entrenador y jugador</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User ID (Entrenador) *
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="ej: entrenador123"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Player ID (Opcional)
              </label>
              <input
                type="text"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                placeholder="ej: jugador456"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Jugador (Opcional)
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="ej: Juan Pérez"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={!videoFile || !userId || isSaving}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? '💾 Guardando...' : '💾 Guardar en Historial'}
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
                <h3 className="font-semibold text-green-900 mb-2">✅ Análisis Guardado</h3>
                <p className="text-green-800">{result.message}</p>
              </div>

              {/* Información del Análisis */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">📋 Información del Análisis</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">ID:</span> {result.analysisId}
                  </div>
                  <div>
                    <span className="font-medium">Usuario:</span> {result.metadata.userId}
                  </div>
                  <div>
                    <span className="font-medium">Jugador:</span> {result.metadata.playerName || 'No especificado'}
                  </div>
                  <div>
                    <span className="font-medium">Archivo:</span> {result.metadata.originalFileName}
                  </div>
                  <div>
                    <span className="font-medium">Duración:</span> {result.metadata.duration}
                  </div>
                  <div>
                    <span className="font-medium">FPS:</span> {result.metadata.fps}
                  </div>
                  <div>
                    <span className="font-medium">Resolución:</span> {result.metadata.resolution}
                  </div>
                  <div>
                    <span className="font-medium">Tamaño:</span> {result.metadata.processedSize} bytes
                  </div>
                </div>
              </div>

              {/* Video */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3">🎬 Video Guardado</h3>
                <video
                  src={result.videoUrl}
                  controls
                  className="w-full max-w-md rounded-lg"
                >
                  Tu navegador no soporta la reproducción de video.
                </video>
                <p className="text-sm text-blue-700 mt-2">
                  URL: <a href={result.videoUrl} target="_blank" rel="noopener noreferrer" className="underline">{result.videoUrl}</a>
                </p>
              </div>

              {/* Análisis de Gemini */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 mb-3">🧠 Análisis de Gemini</h3>
                {result.analysis?.candidates?.[0]?.content?.parts?.[0]?.text ? (
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                      {result.analysis.candidates[0].content.parts[0].text}
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-yellow-800">⚠️ No se pudo cargar el análisis</p>
                  </div>
                )}
              </div>

              {/* Enlaces */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">🔗 Enlaces Útiles</h3>
                <div className="space-y-2">
                  <a
                    href="/video-history"
                    className="inline-block bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    📚 Ver Historial Completo
                  </a>
                  <a
                    href="/test-gemini-direct-upload"
                    className="inline-block bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors ml-2"
                  >
                    🎬 Probar Sin Guardar
                  </a>
                </div>
              </div>

              {/* Tiempo de Procesamiento */}
              <div className="text-center text-sm text-gray-500">
                Guardado el: {new Date(result.createdAt).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

