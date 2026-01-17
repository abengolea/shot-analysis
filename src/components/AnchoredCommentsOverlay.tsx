'use client';

import { useEffect, useState, useRef } from 'react';
import { Keyframe, KeyframeNote } from '@/lib/timeline-types';
import { MessageSquare, X } from 'lucide-react';

interface AnchoredCommentsOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  keyframes: Keyframe[];
  currentTimeMs: number;
  tolerance?: number; // Ventana de tiempo en ms para mostrar comentarios
}

export default function AnchoredCommentsOverlay({
  videoRef,
  keyframes,
  currentTimeMs,
  tolerance = 250, // Mostrar comentarios ±250ms del momento actual
}: AnchoredCommentsOverlayProps) {
  const [videoBounds, setVideoBounds] = useState<DOMRect | null>(null);
  const [visibleComments, setVisibleComments] = useState<Array<{
    note: KeyframeNote;
    keyframe: Keyframe;
    position: { x: number; y: number };
  }>>([]);
  const [dismissedNotes, setDismissedNotes] = useState<Set<string>>(new Set());

  // Actualizar bounds del video cuando cambia el tamaño
  useEffect(() => {
    const updateBounds = () => {
      if (videoRef.current) {
        setVideoBounds(videoRef.current.getBoundingClientRect());
      }
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, [videoRef]);

  // Calcular comentarios visibles basados en el tiempo actual
  useEffect(() => {
    if (!videoRef.current) {
      setVisibleComments([]);
      return;
    }

    const videoRect = videoRef.current.getBoundingClientRect();
    const visible: typeof visibleComments = [];

    for (const kf of keyframes) {
      const timeDiff = Math.abs(kf.tMs - currentTimeMs);
      
      // Solo mostrar comentarios dentro de la ventana de tolerancia
      if (timeDiff <= tolerance) {
        for (const note of kf.notes) {
          if (dismissedNotes.has(note.id)) continue;
          
          // Si el comentario tiene un anclaje, calcular posición
          if (note.anchor && note.anchor !== 'none' && kf.pose?.anchors) {
            const anchor = kf.pose.anchors[note.anchor];
            if (anchor) {
              // Coordenadas normalizadas (0..1) - se convertirán a píxeles en el render
              const x = anchor.x;
              const y = anchor.y;
              
              visible.push({
                note,
                keyframe: kf,
                position: { x, y },
              });
            }
          }
        }
      }
    }

    setVisibleComments(visible);
  }, [currentTimeMs, keyframes, tolerance, dismissedNotes, videoRef]);

  const handleDismiss = (noteId: string) => {
    setDismissedNotes(prev => new Set(prev).add(noteId));
  };

  if (visibleComments.length === 0 || !videoRef.current) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {visibleComments.map(({ note, keyframe, position }) => {
        // Convertir coordenadas normalizadas (0..1) a píxeles relativos al contenedor
        const x = position.x * 100; // Porcentaje
        const y = position.y * 100; // Porcentaje
        
        return (
          <div
            key={note.id}
            className="absolute pointer-events-auto"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -100%)',
            }}
          >
          <div className="bg-blue-600 text-white rounded-lg shadow-lg p-3 max-w-xs min-w-[200px] animate-pulse">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-xs font-medium">
                    {note.author === 'system' ? '🤖 Sistema' : '👤 Usuario'}
                  </span>
                </div>
                <p className="text-sm mb-2">{note.text}</p>
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {note.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-xs bg-blue-700 px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-xs text-blue-200 mt-1">
                  {keyframe.eventType && keyframe.eventType !== 'manual' && (
                    <span className="capitalize">
                      {keyframe.eventType.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDismiss(note.id)}
                className="text-white hover:text-blue-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Indicador del punto de anclaje */}
            <div
              className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full"
            >
              <div className="w-2 h-2 bg-blue-600 rounded-full border-2 border-white" />
            </div>
          </div>
          </div>
        );
      })}
    </div>
  );
}

