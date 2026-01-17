import type { Keypoint } from './pose-detection';

export type KeyframeAnchor = 'elbow' | 'hip' | 'wrist' | 'knee' | 'shoulder' | 'none';

export type KeyframeNote = {
  id: string;
  author: string;
  text: string;
  tags?: string[];
  createdAt: string;
  anchor?: KeyframeAnchor;
};

export type KeyframePose = {
  keypoints: Keypoint[];
  anchors?: {
    elbow?: { x: number; y: number };
    hip?: { x: number; y: number };
    wrist?: { x: number; y: number };
    knee?: { x: number; y: number };
    shoulder?: { x: number; y: number };
  };
};

export type Keyframe = {
  id: string;
  tMs: number;
  thumbUrl?: string;
  notes?: KeyframeNote[];
  eventType?: string;
  pose?: KeyframePose;
};

export type Timeline = {
  videoUrl: string;
  durationMs: number;
  fps: number;
  keyframes: Keyframe[];
  analysisId: string;
};
