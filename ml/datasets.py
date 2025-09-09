import glob
import json
import os
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch
from torch.utils.data import Dataset

try:
    import orjson as fastjson
    def loads(b: bytes):
        return fastjson.loads(b)
except Exception:
    def loads(b: bytes):
        return json.loads(b)

POSE_NAMES = [
    "nose","left_eye_inner","left_eye","left_eye_outer","right_eye_inner","right_eye","right_eye_outer",
    "left_ear","right_ear","mouth_left","mouth_right","left_shoulder","right_shoulder","left_elbow",
    "right_elbow","left_wrist","right_wrist","left_pinky","right_pinky","left_index","right_index",
    "left_thumb","right_thumb","left_hip","right_hip","left_knee","right_knee","left_ankle","right_ankle",
    "left_heel","right_heel","left_foot_index","right_foot_index",
]

NAME_TO_IDX = {n: i for i, n in enumerate(POSE_NAMES)}


def _load_json(path: str) -> Dict[str, Any]:
    with open(path, "rb") as f:
        data = f.read()
    return loads(data)


def normalize_sequence_xy(seq_xy: np.ndarray) -> np.ndarray:
    """
    Normaliza XY por frame:
    - centra en pelvis (promedio de left_hip y right_hip si existen)
    - escala por distancia entre hombros (left_shoulder-right_shoulder) si existe; fallback: 1.0

    seq_xy: [T, J, 2]
    return: [T, J, 2] normalizado
    """
    T, J, C = seq_xy.shape
    out = seq_xy.copy()

    left_hip = NAME_TO_IDX.get("left_hip")
    right_hip = NAME_TO_IDX.get("right_hip")
    left_shoulder = NAME_TO_IDX.get("left_shoulder")
    right_shoulder = NAME_TO_IDX.get("right_shoulder")

    for t in range(T):
        pelvis = None
        scale = 1.0

        if left_hip is not None and right_hip is not None:
            pelvis = 0.5 * (out[t, left_hip, :2] + out[t, right_hip, :2])
        else:
            pelvis = np.array([0.5, 0.5], dtype=np.float32)

        if left_shoulder is not None and right_shoulder is not None:
            d = np.linalg.norm(out[t, left_shoulder, :2] - out[t, right_shoulder, :2])
            if d > 1e-6:
                scale = d

        out[t, :, :2] = (out[t, :, :2] - pelvis) / max(scale, 1e-3)

    return out


class PoseSequenceDataset(Dataset):
    def __init__(self, root: str, split: str = "train", require_targets: bool = False):
        self.root = root
        self.split = split
        self.require_targets = require_targets

        self.files = sorted(glob.glob(os.path.join(root, split, "*.json")))
        if len(self.files) == 0:
            raise FileNotFoundError(f"No JSON files found in {os.path.join(root, split)}")

    def __len__(self) -> int:
        return len(self.files)

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        path = self.files[idx]
        sample = _load_json(path)

        frames = sample["frames"]
        T = len(frames)
        J = len(POSE_NAMES)

        seq_xy = np.zeros((T, J, 2), dtype=np.float32)
        seq_v = np.zeros((T, J, 1), dtype=np.float32)

        for t, fr in enumerate(frames):
            for kp in fr["keypoints"]:
                j = NAME_TO_IDX.get(kp["name"], None)
                if j is None or j >= J:
                    continue
                seq_xy[t, j, 0] = float(kp.get("x", 0.0))
                seq_xy[t, j, 1] = float(kp.get("y", 0.0))
                seq_v[t, j, 0] = float(kp.get("v", 0.0))

        seq_xy = normalize_sequence_xy(seq_xy)
        seq = np.concatenate([seq_xy, seq_v], axis=-1)  # [T, J, 3]

        x = torch.from_numpy(seq).float()  # [T, J, 3]
        y_cls = None
        y_reg = None

        # opcionales si existen en el JSON
        labels = sample.get("labels", None)
        targets = sample.get("targets", None)
        if labels is not None:
            # convertir dict de etiqueta->0/1 a vector ordenado alfabéticamente
            label_keys = sorted(labels.keys())
            y_cls = torch.tensor([float(labels[k]) for k in label_keys], dtype=torch.float32)
        if targets is not None:
            target_keys = sorted(targets.keys())
            y_reg = torch.tensor([float(targets[k]) for k in target_keys], dtype=torch.float32)

        return {
            "x": x,  # [T, J, 3]
            "y_cls": y_cls,  # [L] o None
            "y_reg": y_reg,  # [R] o None
            "path": path,
        }
