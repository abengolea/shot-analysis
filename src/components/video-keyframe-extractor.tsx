import React, { useState, useRef } from 'react';
import { Upload, Image, Loader2, Download, Play } from 'lucide-react';

interface Keyframe {
  timestamp: number;
  url: string;
  blob: Blob;
  base64: string; // Agregar base64 para serialización
  index: number;
}

interface VideoKeyframeExtractorProps {
  onKeyframesExtracted: (keyframes: Keyframe[]) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}

const VideoKeyframeExtractor: React.FC<VideoKeyframeExtractorProps> = ({
  onKeyframesExtracted,
  isProcessing,
  setIsProcessing
}) => {
  // Función para convertir Blob a Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extraer solo la parte base64 (sin el prefijo data:image/jpeg;base64,)
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [keyframes, setKeyframes] = useState<Keyframe[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Función principal para extraer keyframes
  const extractKeyframes = async (file: File, numberOfFrames: number = 8): Promise<Keyframe[]> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('No se pudo obtener contexto del canvas'));
        return;
      }
      
      video.src = URL.createObjectURL(file);
      video.load();
      
      video.addEventListener('loadedmetadata', async () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const duration = video.duration;
        const frameInterval = duration / numberOfFrames;
        const frames: Keyframe[] = [];
        
        for (let i = 0; i < numberOfFrames; i++) {
          const currentTime = i * frameInterval;
          
          // Esperar a que el frame esté listo
          await new Promise<void>((resolve) => {
            video.currentTime = currentTime;
            video.addEventListener('seeked', () => {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              
              // Convertir canvas a blob
              canvas.toBlob(async (blob) => {
                if (blob) {
                  const url = URL.createObjectURL(blob);
                  
                  // Convertir blob a base64 para serialización
                  const base64 = await blobToBase64(blob);
                  
                  frames.push({
                    timestamp: currentTime,
                    url: url,
                    blob: blob,
                    base64: base64,
                    index: i
                  });
                  setProgress(Math.round(((i + 1) / numberOfFrames) * 100));
                }
                resolve();
              }, 'image/jpeg', 0.8);
            }, { once: true });
          });
        }
        
        URL.revokeObjectURL(video.src);
        resolve(frames);
      });
      
      video.addEventListener('error', reject);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) {
      alert('Por favor selecciona un archivo de video válido');
      return;
    }
    
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setKeyframes([]);
    setProgress(0);
  };

  const processVideo = async () => {
    if (!videoFile) return;
    
    setIsProcessing(true);
    try {
      // Extraer keyframes
      const frames = await extractKeyframes(videoFile, 8);
      setKeyframes(frames);
      
      // Notificar al componente padre
      onKeyframesExtracted(frames);
      
    } catch (error) {
      console.error('Error processing video:', error);
      alert('Error al procesar el video');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const downloadKeyframe = (keyframe: Keyframe, index: number) => {
    const link = document.createElement('a');
    link.href = keyframe.url;
    link.download = `keyframe_${index}_${Math.round(keyframe.timestamp)}s.jpg`;
    link.click();
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Extractor de Keyframes de Video
      </h2>
      
      {/* Selector de archivo */}
      <div className="mb-6">
        <label className="block w-full">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-600 mb-2">
              Haz clic para seleccionar un video
            </p>
            <p className="text-sm text-gray-500">
              MP4, WebM, MOV (Max 100MB)
            </p>
            <input
              type="file"
              className="hidden"
              accept="video/*"
              onChange={handleFileSelect}
            />
          </div>
        </label>
      </div>

      {/* Vista previa del video */}
      {videoUrl && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">
            Video Cargado
          </h3>
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full max-w-2xl mx-auto rounded-lg shadow"
            controls
          />
          
          <button
            onClick={processVideo}
            disabled={isProcessing}
            className="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
          >
            {isProcessing ? (
              <>
                <Loader2 className="animate-spin h-5 w-5" />
                Procesando... {progress}%
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                Extraer Keyframes
              </>
            )}
          </button>
        </div>
      )}

      {/* Barra de progreso */}
      {isProcessing && (
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Galería de keyframes */}
      {keyframes.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">
            Keyframes Extraídos ({keyframes.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {keyframes.map((keyframe, index) => (
              <div
                key={index}
                className="relative group border rounded-lg overflow-hidden shadow hover:shadow-lg transition-shadow"
              >
                <img
                  src={keyframe.url}
                  alt={`Keyframe ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-sm mb-2">
                      {keyframe.timestamp.toFixed(1)}s
                    </p>
                    <button
                      onClick={() => downloadKeyframe(keyframe, index)}
                      className="bg-white text-gray-800 px-3 py-1 rounded text-sm hover:bg-gray-100 flex items-center gap-1"
                    >
                      <Download className="h-4 w-4" />
                      Descargar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Canvas oculto para procesamiento */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default VideoKeyframeExtractor;
