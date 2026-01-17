/**
 * Tipos para sistema de timeline con keyframes y comentarios
 */

import { Keypoint } from '@/lib/pose-detection';

export type KeyframeNote = {
  id: string;
  author: string;
  text: string;
  tags?: string[];
  createdAt: string;
  anchor?: 'elbow' | 'hip' | 'wrist' | 'knee' | 'shoulder' | 'none';
};

export type KeyframePose = {
  keypoints: Keypoint[];
  // Coordenadas de keypoints específicos para anclaje rápido
  anchors?: {
    elbow?: { x: number; y: number };      // right_elbow
    hip?: { x: number; y: number };      // right_hip
    wrist?: { x: number; y: number };    // right_wrist
    knee?: { x: number; y: number };    // right_knee
    shoulder?: { x: number; y: number }; // right_shoulder
  };
};

export type Keyframe = {
  id: string;           // uuid
  tMs: number;          // timestamp en ms
  thumbUrl: string;     // URL miniatura
  pose?: KeyframePose;  // opcional: keypoints/ángulos en ese instante
  notes: KeyframeNote[];
  eventType?: 't0_start' | 'set_point' | 'release' | 'onset_piernas' | 'onset_cadera' | 'onset_brazo' | 'peak_velocity' | 'manual';
};

export type Timeline = {
  videoUrl: string;
  durationMs: number;
  fps: number;
  keyframes: Keyframe[];
  analysisId: string;
};

export type CommentRequest = {
  tMs: number;
  text: string;
  tag?: string;
  anchor?: 'elbow' | 'hip' | 'wrist' | 'knee' | 'shoulder' | 'none';
};

