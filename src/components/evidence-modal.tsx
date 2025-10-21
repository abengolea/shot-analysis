'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Eye, Camera } from 'lucide-react';

type EvidenceFrame = {
  frameId: string;
  label: string;
  angle?: string;
  note?: string;
  imageUrl?: string;
};

interface EvidenceModalProps {
  analysisId: string;
  paramId: string;
  paramName: string;
  onClose: () => void;
  isPro?: boolean;
  keyframes?: Array<{
    index: number;
    timestamp: number;
    description: string;
    imageUrl: string;
  }>;
}

export function EvidenceModal({ 
  analysisId, 
  paramId, 
  paramName, 
  onClose, 
  isPro = true,
  keyframes = []
}: EvidenceModalProps) {
  const [frames, setFrames] = useState<EvidenceFrame[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPro) {
      setLoading(false);
      return;
    }

    // Usar keyframes reales del video
    const loadRealEvidence = async () => {
      try {
        setLoading(true);
        
        // Simular delay de carga
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (keyframes && keyframes.length > 0) {
          // Buscar fotogramas específicos de evidencia para este parámetro
          // Por ahora usar los primeros 2-3 keyframes como evidencia
          const evidenceFrames: EvidenceFrame[] = keyframes.slice(0, 3).map((kf, index) => {
            // Determinar el momento basado en el índice del keyframe
            let label = "preparacion";
            let angle = "frontal";
            let note = kf.description;
            
            if (kf.index < 4) {
              label = "preparacion";
              note = "Momento de preparación del tiro";
            } else if (kf.index < 8) {
              label = "ascenso";
              note = "Fase de ascenso del balón";
            } else if (kf.index < 12) {
              label = "liberacion";
              note = "Momento de liberación del balón";
            } else {
              label = "follow_through";
              note = "Fase de seguimiento";
            }
            
            return {
              frameId: `frame_${kf.index}`,
              label,
              angle,
              note,
              imageUrl: kf.imageUrl
            };
          });
          
          setFrames(evidenceFrames);
        } else {
          // Fallback a datos de prueba si no hay keyframes
          const mockFrames: EvidenceFrame[] = [
            {
              frameId: "frame_1",
              label: "preparacion",
              angle: "frontal",
              note: "Pies alineados con el aro",
              imageUrl: `https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=300&fit=crop&crop=center`
            },
            {
              frameId: "frame_4", 
              label: "preparacion",
              angle: "frontal",
              note: "Posición inicial correcta",
              imageUrl: `https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop&crop=center`
            }
          ];
          
          setFrames(mockFrames);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadRealEvidence();
  }, [analysisId, paramId, isPro]);

  const getLabelColor = (label: string) => {
    const labelColors: Record<string, string> = {
      'preparacion': 'bg-blue-100 text-blue-800',
      'ascenso': 'bg-green-100 text-green-800',
      'set_point': 'bg-purple-100 text-purple-800',
      'liberacion': 'bg-orange-100 text-orange-800',
      'follow_through': 'bg-pink-100 text-pink-800',
      'general': 'bg-gray-100 text-gray-800'
    };
    return labelColors[label] || 'bg-gray-100 text-gray-800';
  };

  const getAngleIcon = (angle?: string) => {
    switch (angle) {
      case 'frontal': return '📷';
      case 'lateral': return '👁️';
      case 'diagonal': return '📐';
      default: return '📹';
    }
  };

  if (!isPro) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
          <div className="flex items-center justify-between p-6 border-b">
            <h3 className="font-semibold text-lg">🔒 Evidencia Visual - PRO</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-black">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Camera className="w-8 h-8 text-purple-600" />
            </div>
            <h4 className="font-semibold text-lg mb-2">Evidencia Visual Disponible</h4>
            <p className="text-gray-600 mb-4">
              Para ver los fotogramas que respaldan el análisis de <strong>{paramName}</strong>, 
              necesitas una suscripción PRO.
            </p>
            <div className="space-y-2">
              <div className="text-sm text-gray-500">✅ Fotogramas específicos del momento</div>
              <div className="text-sm text-gray-500">✅ Anotaciones técnicas detalladas</div>
              <div className="text-sm text-gray-500">✅ Múltiples ángulos de cámara</div>
            </div>
          </div>
          
          <div className="p-6 border-t bg-gray-50 rounded-b-2xl">
            <Button onClick={onClose} className="w-full">
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h3 className="font-semibold text-lg">Evidencia Visual</h3>
            <p className="text-sm text-gray-600">{paramName}</p>
            {keyframes && keyframes.length > 0 && keyframes[0]?.imageUrl?.startsWith('data:') ? (
              <p className="text-xs text-green-600 mt-1">📸 Fotogramas reales del video subido</p>
            ) : keyframes && keyframes.length > 0 ? (
              <p className="text-xs text-blue-600 mt-1">📸 Fotogramas del video</p>
            ) : (
              <p className="text-xs text-orange-600 mt-1">📸 Datos de demostración - Imágenes de ejemplo</p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-black transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span className="ml-3 text-gray-600">Cargando evidencias...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="text-red-500 mb-2">❌ Error al cargar evidencias</div>
              <p className="text-sm text-gray-600">{error}</p>
            </div>
          )}

          {!loading && !error && frames && frames.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-gray-400" />
              </div>
              <h4 className="font-semibold text-lg mb-2">Sin Evidencia Visual</h4>
              <p className="text-gray-600">
                No hay fotogramas disponibles para este parámetro.
              </p>
            </div>
          )}

          {!loading && !error && frames && frames.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {frames.map((frame, index) => (
                <Card key={`${frame.frameId}-${index}`} className="overflow-hidden">
                  <div className="relative">
                    <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      {frame.imageUrl ? (
                        <img 
                          src={frame.imageUrl} 
                          alt={frame.label}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-center text-gray-500">
                          <Camera className="w-12 h-12 mx-auto mb-2" />
                          <div className="text-sm">Fotograma {frame.frameId}</div>
                        </div>
                      )}
                    </div>
                    
                    <div className="absolute top-3 left-3">
                      <Badge className={`${getLabelColor(frame.label)} border-0`}>
                        {frame.label.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    {frame.angle && (
                      <div className="absolute top-3 right-3">
                        <Badge variant="outline" className="bg-white/90">
                          {getAngleIcon(frame.angle)} {frame.angle}
                        </Badge>
                      </div>
                    )}
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-600">Momento:</span>
                        <span className="text-sm capitalize">{frame.label.replace('_', ' ')}</span>
                      </div>
                      
                      {frame.angle && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-600">Ángulo:</span>
                          <span className="text-sm capitalize">{frame.angle}</span>
                        </div>
                      )}
                      
                      {frame.note && (
                        <div className="pt-2 border-t">
                          <p className="text-sm text-gray-700">{frame.note}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {frames && frames.length > 0 && (
                <span>{frames.length} fotograma{frames.length !== 1 ? 's' : ''} de evidencia</span>
              )}
            </div>
            <Button onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
