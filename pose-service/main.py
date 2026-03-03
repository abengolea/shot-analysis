from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import tempfile
import requests
import cv2
import mediapipe as mp
import numpy as np
import os


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


class PoseRequest(BaseModel):
    videoUrl: str = Field(..., min_length=3)
    targetFrames: int = Field(8, ge=6, le=90)


class PoseResponse(BaseModel):
    frames: list
    fps: float


app = FastAPI()


def download_video_to_temp(video_url: str) -> str:
    resp = requests.get(video_url, timeout=30)
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="No se pudo descargar el video.")
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    tmp.write(resp.content)
    tmp.flush()
    tmp.close()
    return tmp.name


def extract_pose_frames(video_path: str, target_frames: int) -> tuple[list, float]:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise HTTPException(status_code=400, detail="No se pudo abrir el video.")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    stride = max(1, int(total_frames / max(1, target_frames))) if total_frames > 0 else 1

    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=0,
        smooth_landmarks=True,
        enable_segmentation=False,
        min_detection_confidence=0.4,
        min_tracking_confidence=0.4,
    )

    frames = []
    frame_index = 0
    collected = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_index % stride != 0:
            frame_index += 1
            continue

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(rgb)

        if results.pose_landmarks is not None:
            landmarks = results.pose_landmarks.landmark
            keypoints = []
            for i, lm in enumerate(landmarks[: len(POSE_LANDMARK_NAMES)]):
                x = float(np.clip(lm.x, 0.0, 1.0))
                y = float(np.clip(lm.y, 0.0, 1.0))
                v = float(np.clip(lm.visibility if lm.visibility is not None else 0.0, 0.0, 1.0))
                name = POSE_LANDMARK_NAMES[i] if i < len(POSE_LANDMARK_NAMES) else f"kp_{i}"
                keypoints.append({"name": name, "x": x, "y": y, "score": v})
        else:
            keypoints = [{"name": n, "x": 0.0, "y": 0.0, "score": 0.0} for n in POSE_LANDMARK_NAMES]

        t_ms = int((frame_index / fps) * 1000)
        frames.append({"tMs": t_ms, "keypoints": keypoints})
        collected += 1
        frame_index += 1

        if collected >= target_frames:
            break

    cap.release()
    pose.close()
    return frames, float(fps)


@app.post("/pose", response_model=PoseResponse)
def pose_endpoint(req: PoseRequest):
    video_path = download_video_to_temp(req.videoUrl)
    try:
        frames, fps = extract_pose_frames(video_path, req.targetFrames)
        return {"frames": frames, "fps": fps}
    finally:
        try:
            os.remove(video_path)
        except Exception:
            pass


@app.get("/health")
def health_check():
    return {"status": "ok"}
