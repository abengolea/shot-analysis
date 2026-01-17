'use client';

import { useState, useRef, useEffect } from 'react';
import { Keyframe, Timeline as TimelineType } from '@/lib/timeline-types';
import { MessageSquare, Plus, Play, Pause } from 'lucide-react';
import AnchoredCommentsOverlay from './AnchoredCommentsOverlay';

interface TimelineProps {
  timeline: TimelineType;
  videoRef: React.RefObject<HTMLVideoElement>;
  onSeek: (tMs: number) => void;
  onAddComment: (tMs: number) => void;
  analysisId: string;
}

export default function Timeline({ timeline, videoRef, onSeek, onAddComment, analysisId }: TimelineProps) {
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentTag, setCommentTag] = useState('');
  const [selectedAnchor, setSelectedAnchor] = useState<'elbow' | 'hip' | 'wrist' | 'knee' | 'shoulder' | 'none'>('none');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timelineData, setTimelineData] = useState(timeline);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [showAnchoredComments, setShowAnchoredComments] = useState(true);

  // Cargar timeline actualizado desde API
  useEffect(() => {
    const loadTimeline = async () => {
      try {
        const res = await fetch(`/api/test-biomechanical-transfer/${analysisId}/comments`);
        if (res.ok) {
          const data = await res.json();
          if (data.timeline) {
            setTimelineData(data.timeline);
          }
        }
      } catch (error) {
        console.warn('Error cargando timeline:', error);
      }
    };

    if (analysisId) {
      loadTimeline();
    }
  }, [analysisId]);

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
  }, [videoRef]);

  const handleAddComment = () => {
    if (!videoRef.current) return;
    const currentTimeMs = Math.round(videoRef.current.currentTime * 1000);
    setIsAddingComment(true);
    setCommentText('');
    setCommentTag('');
    setSelectedAnchor('none');
  };

  const handleSubmitComment = async () => {
    if (!videoRef.current || !commentText.trim()) return;

    setIsSubmitting(true);
    const currentTimeMs = Math.round(videoRef.current.currentTime * 1000);

    try {
      const res = await fetch(`/api/test-biomechanical-transfer/${analysisId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tMs: currentTimeMs,
          text: commentText.trim(),
          tag: commentTag || undefined,
          anchor: selectedAnchor !== 'none' ? selectedAnchor : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Actualizar timeline local
        if (data.timeline) {
          setTimelineData(data.timeline);
        }
        setIsAddingComment(false);
        setCommentText('');
        setCommentTag('');
        setSelectedAnchor('none');
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || 'No se pudo agregar el comentario'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            Timeline con Comentarios
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAnchoredComments(!showAnchoredComments)}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${
                showAnchoredComments
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title="Mostrar/ocultar comentarios anclados en el video"
            >
              📍 Anclados
            </button>
            <button
              onClick={handleAddComment}
              className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              disabled={!videoRef.current}
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar Comentario
            </button>
          </div>
        </div>

      {/* Formulario de comentario */}
      {isAddingComment && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comentario (en {videoRef.current ? formatTime(Math.round(videoRef.current.currentTime * 1000)) : '0:00'})
              </label>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Escribe tu comentario sobre este momento del video..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tag (opcional)
                </label>
                <input
                  type="text"
                  value={commentTag}
                  onChange={(e) => setCommentTag(e.target.value)}
                  placeholder="Ej: set-point, brazos-anticipados"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anclar a (opcional)
                </label>
                <select
                  value={selectedAnchor}
                  onChange={(e) => setSelectedAnchor(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="none">Ninguno</option>
                  <option value="elbow">Codo</option>
                  <option value="hip">Cadera</option>
                  <option value="wrist">Muñeca</option>
                  <option value="knee">Rodilla</option>
                  <option value="shoulder">Hombro</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmitComment}
                disabled={!commentText.trim() || isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={() => {
                  setIsAddingComment(false);
                  setCommentText('');
                  setCommentTag('');
                  setSelectedAnchor('none');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline horizontal con miniaturas */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {timelineData.keyframes.map((kf) => (
            <button
              key={kf.id}
              onClick={() => onSeek(kf.tMs)}
              className="relative flex-shrink-0 group"
            >
              <div className="relative">
                {kf.thumbUrl ? (
                  <img
                    src={kf.thumbUrl}
                    alt={`${formatTime(kf.tMs)}`}
                    className="h-20 w-auto rounded border-2 border-gray-300 group-hover:border-blue-500 transition-colors"
                  />
                ) : (
                  <div className="h-20 w-32 bg-gray-200 rounded border-2 border-gray-300 flex items-center justify-center text-xs text-gray-500">
                    {formatTime(kf.tMs)}
                  </div>
                )}
                {kf.notes.length > 0 && (
                  <span className="absolute top-1 right-1 bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {kf.notes.length}
                  </span>
                )}
                {kf.eventType && kf.eventType !== 'manual' && (
                  <span className="absolute bottom-1 left-1 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded">
                    {kf.eventType === 't0_start' ? 'Inicio' :
                     kf.eventType === 'set_point' ? 'Set-point' :
                     kf.eventType === 'release' ? 'Release' :
                     kf.eventType === 'peak_velocity' ? 'Pico' :
                     kf.eventType.startsWith('onset_') ? 'Onset' : kf.eventType}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-600 mt-1 text-center">
                {formatTime(kf.tMs)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lista de comentarios por keyframe */}
      <div className="mt-4 space-y-3">
        {timelineData.keyframes
          .filter(kf => kf.notes.length > 0)
          .map((kf) => (
            <div key={kf.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">
                  {formatTime(kf.tMs)}
                </span>
                <button
                  onClick={() => onSeek(kf.tMs)}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Ir a este momento
                </button>
              </div>
              <div className="space-y-2">
                {kf.notes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-white p-2 rounded border border-gray-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-gray-800">{note.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {note.author === 'system' ? '🤖 Sistema' : '👤 Usuario'}
                          </span>
                          {note.tags && note.tags.length > 0 && (
                            <div className="flex gap-1">
                              {note.tags.map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {note.anchor && note.anchor !== 'none' && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                              📍 {note.anchor}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      {timelineData.keyframes.filter(kf => kf.notes.length > 0).length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          No hay comentarios aún. Haz clic en "Agregar Comentario" para empezar.
        </p>
      )}
    </div>
  );
}

