'use client';

import { useState, useEffect } from 'react';

interface VideoAnalysis {
  id: string;
  userId: string;
  playerId: string | null;
  playerName: string | null;
  videoUrl: string;
  originalFileName: string;
  analysis: any;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

export default function VideoHistoryPage() {
  const [userId, setUserId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [analyses, setAnalyses] = useState<VideoAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<VideoAnalysis | null>(null);

  const loadHistory = async () => {
    if (!userId) {
      setError('Por favor ingresa un userId');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        userId: userId,
        limit: '20'
      });

      if (playerId) {
        params.append('playerId', playerId);
      }

      const response = await fetch(`/api/get-video-history?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error cargando historial');
      }

      setAnalyses(data.analyses);
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAnalysis = async (analysisId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este análisis?')) {
      return;
    }

    try {
      const params = new URLSearchParams({
        analysisId: analysisId,
        userId: userId
      });

      const response = await fetch(`/api/get-video-history?${params}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error eliminando análisis');
      }

      // Recargar historial
      await loadHistory();
    } catch (err: any) {
      setError(err.message || 'Error eliminando análisis');
    }
  };

  useEffect(() => {
    if (userId) {
      loadHistory();
    }
  }, [userId, playerId]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            📚 Historial de Análisis de Videos
          </h1>
          
          {/* Filtros */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User ID (Entrenador)
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="ej: entrenador123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              onClick={loadHistory}
              disabled={!userId || isLoading}
              className="bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '🔄 Cargando...' : '🔍 Cargar Historial'}
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-semibold">❌ Error:</p>
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Lista de Análisis */}
          {analyses.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">
                📋 Análisis Encontrados ({analyses.length})
              </h2>
              
              {analyses.map((analysis) => (
                <div key={analysis.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {analysis.originalFileName}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {analysis.playerName ? `Jugador: ${analysis.playerName}` : 'Sin jugador específico'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(analysis.createdAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        Duración: {analysis.metadata.duration} | FPS: {analysis.metadata.fps} | Resolución: {analysis.metadata.resolution}
                      </p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedAnalysis(analysis)}
                        className="bg-green-600 text-white py-1 px-3 rounded text-sm hover:bg-green-700 transition-colors"
                      >
                        👁️ Ver
                      </button>
                      <button
                        onClick={() => deleteAnalysis(analysis.id)}
                        className="bg-red-600 text-white py-1 px-3 rounded text-sm hover:bg-red-700 transition-colors"
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {analyses.length === 0 && !isLoading && userId && (
            <div className="text-center py-8">
              <p className="text-gray-500">No se encontraron análisis en el historial</p>
            </div>
          )}
        </div>

        {/* Modal de Análisis */}
        {selectedAnalysis && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    📊 Análisis: {selectedAnalysis.originalFileName}
                  </h2>
                  <button
                    onClick={() => setSelectedAnalysis(null)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>

                {/* Video */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">🎬 Video</h3>
                  <video
                    src={selectedAnalysis.videoUrl}
                    controls
                    className="w-full max-w-md rounded-lg"
                  >
                    Tu navegador no soporta la reproducción de video.
                  </video>
                </div>

                {/* Información del Análisis */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">📋 Información</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">ID:</span> {selectedAnalysis.id}
                    </div>
                    <div>
                      <span className="font-medium">Usuario:</span> {selectedAnalysis.userId}
                    </div>
                    <div>
                      <span className="font-medium">Jugador:</span> {selectedAnalysis.playerName || 'No especificado'}
                    </div>
                    <div>
                      <span className="font-medium">Fecha:</span> {new Date(selectedAnalysis.createdAt).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Duración:</span> {selectedAnalysis.metadata.duration}
                    </div>
                    <div>
                      <span className="font-medium">FPS:</span> {selectedAnalysis.metadata.fps}
                    </div>
                    <div>
                      <span className="font-medium">Resolución:</span> {selectedAnalysis.metadata.resolution}
                    </div>
                    <div>
                      <span className="font-medium">Tamaño:</span> {selectedAnalysis.metadata.processedSize} bytes
                    </div>
                  </div>
                </div>

                {/* Análisis de Gemini */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">🧠 Análisis de Gemini</h3>
                  {selectedAnalysis.analysis?.candidates?.[0]?.content?.parts?.[0]?.text ? (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">
                        {selectedAnalysis.analysis.candidates[0].content.parts[0].text}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800">⚠️ No se pudo cargar el análisis</p>
                    </div>
                  )}
                </div>

                {/* Metadatos de Gemini */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">📊 Metadatos de Gemini</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Modelo:</span> {selectedAnalysis.analysis?.modelVersion || 'No especificado'}
                      </div>
                      <div>
                        <span className="font-medium">Finish reason:</span> {selectedAnalysis.analysis?.candidates?.[0]?.finishReason || 'No especificado'}
                      </div>
                      <div>
                        <span className="font-medium">Tokens de prompt:</span> {selectedAnalysis.analysis?.usageMetadata?.promptTokenCount || 'No especificado'}
                      </div>
                      <div>
                        <span className="font-medium">Tokens de respuesta:</span> {selectedAnalysis.analysis?.usageMetadata?.candidatesTokenCount || 'No especificado'}
                      </div>
                      <div>
                        <span className="font-medium">Total tokens:</span> {selectedAnalysis.analysis?.usageMetadata?.totalTokenCount || 'No especificado'}
                      </div>
                      <div>
                        <span className="font-medium">Response ID:</span> {selectedAnalysis.analysis?.responseId || 'No especificado'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

