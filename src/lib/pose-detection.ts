// Pose Detection utilities inspired by AI Basketball Analysis
// https://github.com/chonyy/AI-basketball-analysis

export interface PoseKeypoint {
  x: number;
  y: number;
  confidence: number;
}

export interface PoseLandmarks {
  // OpenPose COCO format keypoints
  nose: PoseKeypoint;
  leftEye: PoseKeypoint;
  rightEye: PoseKeypoint;
  leftEar: PoseKeypoint;
  rightEar: PoseKeypoint;
  leftShoulder: PoseKeypoint;
  rightShoulder: PoseKeypoint;
  leftElbow: PoseKeypoint;
  rightElbow: PoseKeypoint;
  leftWrist: PoseKeypoint;
  rightWrist: PoseKeypoint;
  leftHip: PoseKeypoint;
  rightHip: PoseKeypoint;
  leftKnee: PoseKeypoint;
  rightKnee: PoseKeypoint;
  leftAnkle: PoseKeypoint;
  rightAnkle: PoseKeypoint;
}

export interface BasketballShotAnalysis {
  isShooting: boolean;
  shootingArm: 'left' | 'right' | 'unknown';
  elbowAngle: number;
  kneeAngle: number;
  releaseAngle: number;
  shootingForm: 'good' | 'needs_improvement' | 'poor';
  confidence: number;
  keypoints: PoseLandmarks;
}

export interface BallDetection {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  status: 'normal' | 'shooting' | 'successful' | 'missed';
}

export interface ShotAnalysisResult {
  shotDetected: boolean;
  shotCount: number;
  successfulShots: number;
  missedShots: number;
  ballDetections: BallDetection[];
  poseAnalyses: BasketballShotAnalysis[];
  shotTiming: {
    startFrame: number;
    releaseFrame: number;
    endFrame: number;
  }[];
}

// Calculate angle between three points
export function calculateAngle(
  point1: PoseKeypoint,
  point2: PoseKeypoint,
  point3: PoseKeypoint
): number {
  const vector1 = {
    x: point1.x - point2.x,
    y: point1.y - point2.y
  };
  const vector2 = {
    x: point3.x - point2.x,
    y: point3.y - point2.y
  };

  const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y;
  const magnitude1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y);
  const magnitude2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);

  if (magnitude1 === 0 || magnitude2 === 0) return 0;

  const angle = Math.acos(dotProduct / (magnitude1 * magnitude2));
  return (angle * 180) / Math.PI;
}

// Analyze basketball shooting pose
export function analyzeShootingPose(keypoints: PoseLandmarks): BasketballShotAnalysis {
  // Determine shooting arm based on which elbow is higher
  const leftElbowHigher = keypoints.leftElbow.y < keypoints.rightElbow.y;
  const shootingArm = leftElbowHigher ? 'left' : 'right';
  
  // Calculate key angles
  const shootingElbow = leftElbowHigher ? keypoints.leftElbow : keypoints.rightElbow;
  const shootingWrist = leftElbowHigher ? keypoints.leftWrist : keypoints.rightWrist;
  const shootingShoulder = leftElbowHigher ? keypoints.leftShoulder : keypoints.rightShoulder;
  
  const elbowAngle = calculateAngle(shootingShoulder, shootingElbow, shootingWrist);
  
  // Calculate knee angle (use both knees and average)
  const leftKneeAngle = calculateAngle(keypoints.leftHip, keypoints.leftKnee, keypoints.leftAnkle);
  const rightKneeAngle = calculateAngle(keypoints.rightHip, keypoints.rightKnee, keypoints.rightAnkle);
  const kneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
  
  // Estimate release angle based on arm position
  const releaseAngle = Math.atan2(
    shootingWrist.y - shootingElbow.y,
    shootingWrist.x - shootingElbow.x
  ) * 180 / Math.PI;
  
  // Analyze shooting form
  let shootingForm: 'good' | 'needs_improvement' | 'poor' = 'good';
  let confidence = 0.8;
  
  // Check for good shooting form indicators
  if (elbowAngle < 80 || elbowAngle > 120) {
    shootingForm = 'needs_improvement';
    confidence -= 0.2;
  }
  
  if (kneeAngle < 100 || kneeAngle > 160) {
    shootingForm = 'poor';
    confidence -= 0.3;
  }
  
  // Check if person is in shooting position
  const isShooting = (
    shootingElbow.confidence > 0.5 &&
    shootingWrist.confidence > 0.5 &&
    Math.abs(releaseAngle) > 45 // Arm is extended upward
  );
  
  return {
    isShooting,
    shootingArm,
    elbowAngle,
    kneeAngle,
    releaseAngle,
    shootingForm,
    confidence: Math.max(0, confidence),
    keypoints
  };
}

// Detect basketball in frame (simplified version)
export function detectBasketball(
  frameData: ImageData,
  previousDetections: BallDetection[] = []
): BallDetection[] {
  // This is a simplified detection - in a real implementation,
  // you would use a trained model like Faster R-CNN or YOLO
  
  const detections: BallDetection[] = [];
  
  // For now, return empty array - this would be replaced with actual ML model
  // The AI Basketball Analysis repo uses Faster R-CNN for this
  
  return detections;
}

// Main analysis function
export function analyzeBasketballVideo(
  frames: ImageData[],
  poseData: PoseLandmarks[]
): ShotAnalysisResult {
  const ballDetections: BallDetection[] = [];
  const poseAnalyses: BasketballShotAnalysis[] = [];
  const shotTiming: {
    startFrame: number;
    releaseFrame: number;
    endFrame: number;
  }[] = [];
  
  let shotCount = 0;
  let successfulShots = 0;
  let missedShots = 0;
  let shotDetected = false;
  
  // Analyze each frame
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const pose = poseData[i];
    
    if (!pose) continue;
    
    // Detect basketball in frame
    const ballDetection = detectBasketball(frame, ballDetections);
    ballDetections.push(...ballDetection);
    
    // Analyze pose
    const poseAnalysis = analyzeShootingPose(pose);
    poseAnalyses.push(poseAnalysis);
    
    // Detect shooting motion
    if (poseAnalysis.isShooting && !shotDetected) {
      shotDetected = true;
      shotCount++;
      
      // Estimate shot timing (simplified)
      shotTiming.push({
        startFrame: Math.max(0, i - 5),
        releaseFrame: i,
        endFrame: Math.min(frames.length - 1, i + 5)
      });
    }
  }
  
  // Determine shot success based on ball trajectory (simplified)
  // In real implementation, this would analyze ball path and basket position
  successfulShots = Math.floor(shotCount * 0.7); // Assume 70% success rate for demo
  missedShots = shotCount - successfulShots;
  
  return {
    shotDetected,
    shotCount,
    successfulShots,
    missedShots,
    ballDetections,
    poseAnalyses,
    shotTiming
  };
}
