// Versión con MediaPipe para pose detection (sin dependencias nativas)
let PoseLandmarker: any = null;
let FilesetResolver: any = null;

try {
  const mediapipe = require('@mediapipe/tasks-vision');
  PoseLandmarker = mediapipe.PoseLandmarker;
  FilesetResolver = mediapipe.FilesetResolver;
  console.log('✅ MediaPipe disponible');
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  console.warn('⚠️ MediaPipe no disponible, usando fallback:', message);
}

// Tipos para keypoints
export type KPName =
  | 'nose' | 'left_eye' | 'right_eye' | 'left_ear' | 'right_ear'
  | 'left_shoulder' | 'right_shoulder' | 'left_elbow' | 'right_elbow'
  | 'left_wrist' | 'right_wrist' | 'left_hip' | 'right_hip'
  | 'left_knee' | 'right_knee' | 'left_ankle' | 'right_ankle';

export interface Keypoint {
  name: KPName;
  x: number;   // 0..1
  y: number;   // 0..1
  z?: number;  // opcional (MediaPipe Pose)
  score: number;
}

export interface FramePose {
  tMs: number;
  keypoints: Keypoint[];
}

export interface ShotPoseSample {
  videoId: string;
  fps: number;
  frames: FramePose[];
}

// Mapeo de MediaPipe a nuestros nombres
const MEDIAPIPE_KEYPOINT_NAMES: KPName[] = [
  'nose','left_eye','right_eye','left_ear','right_ear',
  'left_shoulder','right_shoulder','left_elbow','right_elbow',
  'left_wrist','right_wrist','left_hip','right_hip',
  'left_knee','right_knee','left_ankle','right_ankle'
];

// Función para mapear keypoints de MediaPipe
function mapKeypoints(landmarks: any[]): Keypoint[] {
  return landmarks.slice(0, 17).map((landmark, i) => ({
    name: MEDIAPIPE_KEYPOINT_NAMES[i],
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    score: landmark.visibility || 0.8
  }));
}

// Función principal para extraer poses con MediaPipe
export async function extractPosesFromFolderMediaPipe(folderPath: string, fps: number = 12): Promise<ShotPoseSample> {
    // Fallback si MediaPipe no está disponible
    if (!PoseLandmarker || !FilesetResolver) {
      console.warn('⚠️ MediaPipe no disponible, retornando datos vacíos');
      return {
        videoId: 'fallback',
        fps: fps,
        frames: []
      };
    }

    try {
    // Inicializar MediaPipe
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    
    const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task`,
        delegate: "GPU"
      },
      runningMode: "IMAGE",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    
        // Leer archivos de frames
    const fs = await import('fs');
    const path = await import('path');
    
    const files = fs.readdirSync(folderPath)
      .filter(f => f.endsWith('.jpg'))
      .sort();
    
    console.log(`📁 Encontrados ${files.length} frames para procesar`);
    
    const frames: FramePose[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = path.join(folderPath, files[i]);
            try {
        // Leer imagen
        const imageBuffer = fs.readFileSync(file);
        const image = new Image();
        
        // Convertir buffer a Image (simplificado para testing)
        const base64 = imageBuffer.toString('base64');
        image.src = `data:image/jpeg;base64,${base64}`;
        
        // Detectar poses
        const results = poseLandmarker.detect(image);
        
        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          frames.push({
            tMs: Math.round((i * 1000) / fps),
            keypoints: mapKeypoints(landmarks)
          });
                  } else {
                  }
      } catch (error) {
        console.error(`❌ Error procesando frame ${i + 1}:`, error);
      }
    }
    
        return {
      videoId: path.basename(folderPath),
      fps,
      frames
    };
    
  } catch (error) {
    console.error('❌ Error inicializando MediaPipe:', error);
    
    // Fallback: usar versión mock
    console.log('🔄 Fallback: usando versión mock...');
    return await extractPosesFromFolderMock(folderPath, fps);
  }
}

// Función mock para testing
async function extractPosesFromFolderMock(folderPath: string, fps: number = 12): Promise<ShotPoseSample> {
    const fs = await import('fs');
  const path = await import('path');
  
  const files = fs.readdirSync(folderPath)
    .filter(f => f.endsWith('.jpg'))
    .sort();
  
  const frames: FramePose[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const mockKeypoints: Keypoint[] = MEDIAPIPE_KEYPOINT_NAMES.map(name => ({
      name,
      x: Math.random(),
      y: Math.random(),
      z: Math.random() * 0.1,
      score: 0.8 + Math.random() * 0.2
    }));
    
    frames.push({
      tMs: Math.round((i * 1000) / fps),
      keypoints: mockKeypoints
    });
  }
  
  return {
    videoId: path.basename(folderPath),
    fps,
    frames
  };
}

// Función para calcular ángulos biomecánicos
export function calculateBiomechanicalAngles(frames: FramePose[]) {
    const angles = frames.map(frame => {
    const kps = frame.keypoints;
    
    // Encontrar keypoints específicos
    const rightShoulder = kps.find(kp => kp.name === 'right_shoulder');
    const rightElbow = kps.find(kp => kp.name === 'right_elbow');
    const rightWrist = kps.find(kp => kp.name === 'right_wrist');
    const rightHip = kps.find(kp => kp.name === 'right_hip');
    const rightKnee = kps.find(kp => kp.name === 'right_knee');
    const rightAnkle = kps.find(kp => kp.name === 'right_ankle');
    
    if (!rightShoulder || !rightElbow || !rightWrist || !rightHip || !rightKnee || !rightAnkle) {
      return {
        tMs: frame.tMs,
        elbowAngle: null,
        kneeAngle: null,
        hipAngle: null,
        wristAngle: null
      };
    }
    
    // Calcular ángulos
    const elbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
    const kneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    const hipAngle = calculateAngle(rightShoulder, rightHip, rightKnee);
    const wristAngle = calculateAngle(rightElbow, rightWrist, { x: rightWrist.x, y: rightWrist.y - 0.1 });
    
    return {
      tMs: frame.tMs,
      elbowAngle,
      kneeAngle,
      hipAngle,
      wristAngle
    };
  });
  
    return angles;
}

// Función auxiliar para calcular ángulo entre 3 puntos
function calculateAngle(pointA: {x: number, y: number}, pointB: {x: number, y: number}, pointC: {x: number, y: number}): number {
  const v1 = { x: pointA.x - pointB.x, y: pointA.y - pointB.y };
  const v2 = { x: pointC.x - pointB.x, y: pointC.y - pointB.y };
  
  const dot = v1.x * v2.x + v1.y * v2.y;
  const n1 = Math.hypot(v1.x, v1.y);
  const n2 = Math.hypot(v2.x, v2.y);
  
  const cos = Math.min(1, Math.max(-1, dot / (n1 * n2 + 1e-9)));
  return Math.acos(cos) * 180 / Math.PI;
}

// Función para detectar fases del tiro
export function detectShotPhases(angles: any[], frames: FramePose[]) {
  console.log('🏀 Detectando fases del tiro...');
  
  // Encontrar el momento de máxima flexión de rodillas (carga)
  const kneeAngles = angles.map(a => a.kneeAngle).filter(a => a !== null);
  const minKneeAngle = Math.min(...kneeAngles);
  const loadFrame = angles.findIndex(a => a.kneeAngle === minKneeAngle);
  
  // Encontrar el momento de máxima extensión de codo (release)
  const elbowAngles = angles.map(a => a.elbowAngle).filter(a => a !== null);
  const maxElbowAngle = Math.max(...elbowAngles);
  const releaseFrame = angles.findIndex(a => a.elbowAngle === maxElbowAngle);
  
  // Encontrar el momento de máxima elevación (apex)
  const wristY = frames.map(f => {
    const wrist = f.keypoints.find(kp => kp.name === 'right_wrist');
    return wrist ? wrist.y : 0;
  });
  const minWristY = Math.min(...wristY);
  const apexFrame = wristY.findIndex(y => y === minWristY);
  
  const phases = {
    start: 0,
    load: loadFrame,
    release: releaseFrame,
    apex: apexFrame,
    landing: frames.length - 1
  };
  
    return phases;
}

