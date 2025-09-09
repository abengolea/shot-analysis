import argparse
import json
import os
from dataclasses import dataclass
from typing import List, Dict, Any

import cv2
import numpy as np

try:
    import orjson as fastjson
    def dumps(obj):
        return fastjson.dumps(obj)
except Exception:
    def dumps(obj):
        return json.dumps(obj).encode("utf-8")

try:
    import mediapipe as mp
except ImportError as e:
    raise SystemExit("mediapipe is required. Please run: pip install mediapipe") from e

POSE_LANDMARK_NAMES = [
    "nose",
    "left_eye_inner",
    "left_eye",
    "left_eye_outer",
    "right_eye_inner",
    "right_eye",
    "right_eye_outer",
    "left_ear",
    "right_ear",
    "mouth_left",
    "mouth_right",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_pinky",
    "right_pinky",
    "left_index",
    "right_index",
    "left_thumb",
    "right_thumb",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
    "left_heel",
    "right_heel",
    "left_foot_index",
    "right_foot_index",
]

@dataclass
class Keypoint:
    name: str
    x: float
    y: float
    v: float


def extract_from_video(
    video_path: str,
    stride: int = 1,
    model_complexity: int = 1,
    min_detection_confidence: float = 0.5,
    min_tracking_confidence: float = 0.5,
) -> Dict[str, Any]:
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video not found: {video_path}")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=model_complexity,
        smooth_landmarks=True,
        enable_segmentation=False,
        min_detection_confidence=min_detection_confidence,
        min_tracking_confidence=min_tracking_confidence,
    )

    frames: List[Dict[str, Any]] = []
    frame_index = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if stride > 1 and (frame_index % stride != 0):
            frame_index += 1
            continue

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(rgb)

        if results.pose_landmarks is not None:
            landmarks = results.pose_landmarks.landmark
            kps: List[Keypoint] = []
            for i, lm in enumerate(landmarks[: len(POSE_LANDMARK_NAMES)]):
                x = float(np.clip(lm.x, 0.0, 1.0))
                y = float(np.clip(lm.y, 0.0, 1.0))
                v = float(np.clip(lm.visibility if lm.visibility is not None else 0.0, 0.0, 1.0))
                name = POSE_LANDMARK_NAMES[i] if i < len(POSE_LANDMARK_NAMES) else f"kp_{i}"
                kps.append(Keypoint(name=name, x=x, y=y, v=v).__dict__)
        else:
            # No detección, relleno con 0
            kps = [Keypoint(name=n, x=0.0, y=0.0, v=0.0).__dict__ for n in POSE_LANDMARK_NAMES]

        t = frame_index / fps
        frames.append({
            "index": int(frame_index),
            "time_sec": float(t),
            "keypoints": kps,
        })

        frame_index += 1

    cap.release()
    pose.close()

    return {
        "version": 1,
        "source_video": os.path.abspath(video_path),
        "width": width,
        "height": height,
        "fps": float(fps),
        "frames": frames,
    }


def main():
    parser = argparse.ArgumentParser(description="Extraer keypoints 2D (MediaPipe Pose) a JSON")
    parser.add_argument("--video_path", type=str, required=True)
    parser.add_argument("--output_path", type=str, required=True)
    parser.add_argument("--stride", type=int, default=1)
    parser.add_argument("--model_complexity", type=int, default=1)
    parser.add_argument("--min_detection_confidence", type=float, default=0.5)
    parser.add_argument("--min_tracking_confidence", type=float, default=0.5)
    args = parser.parse_args()

    data = extract_from_video(
        video_path=args.video_path,
        stride=args.stride,
        model_complexity=args.model_complexity,
        min_detection_confidence=args.min_detection_confidence,
        min_tracking_confidence=args.min_tracking_confidence,
    )

    out_dir = os.path.dirname(os.path.abspath(args.output_path))
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    with open(args.output_path, "wb") as f:
        f.write(dumps(data))

    print(f"OK: {args.output_path}")


if __name__ == "__main__":
    main()
