"use client";

import { useEffect, useMemo, useRef } from "react";

export type Keypoint = {
  name: string;
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

type SkeletonOverlayProps = {
  keypoints: Keypoint[];
  comparisonKeypoints?: Keypoint[];
  videoWidth: number;
  videoHeight: number;
  currentFrame: number;
  showSkeleton: boolean;
  showEnergyFlow: boolean;
  showComparison: boolean;
  showBackground?: boolean;
};

const connections: Array<[string, string]> = [
  ["left_shoulder", "right_shoulder"],
  ["left_hip", "right_hip"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
];

const energyChains = [
  ["left_ankle", "left_knee", "left_hip", "left_shoulder", "left_elbow", "left_wrist"],
  ["right_ankle", "right_knee", "right_hip", "right_shoulder", "right_elbow", "right_wrist"],
];

function resolveCoords(keypoints: Keypoint[], width: number, height: number) {
  const max = Math.max(...keypoints.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))), 1);
  const isNormalized = max <= 1.5;
  const map = new Map<string, { x: number; y: number; v: number }>();

  keypoints.forEach((kp) => {
    const x = isNormalized ? kp.x * width : kp.x;
    const y = isNormalized ? kp.y * height : kp.y;
    map.set(kp.name, { x, y, v: kp.visibility ?? 1 });
  });

  return map;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  const headLength = 8;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - headLength * Math.cos(angle - Math.PI / 6),
    to.y - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    to.x - headLength * Math.cos(angle + Math.PI / 6),
    to.y - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

export function SkeletonOverlay({
  keypoints,
  comparisonKeypoints,
  videoWidth,
  videoHeight,
  currentFrame,
  showSkeleton,
  showEnergyFlow,
  showComparison,
  showBackground = true,
}: SkeletonOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerClassName = showBackground
    ? "relative w-full overflow-hidden rounded-lg border bg-black"
    : "relative w-full overflow-hidden";

  const primary = useMemo(
    () => resolveCoords(keypoints, videoWidth, videoHeight),
    [keypoints, videoWidth, videoHeight]
  );
  const comparison = useMemo(
    () =>
      comparisonKeypoints ? resolveCoords(comparisonKeypoints, videoWidth, videoHeight) : null,
    [comparisonKeypoints, videoWidth, videoHeight]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (showBackground) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const drawSkeleton = (map: Map<string, { x: number; y: number; v: number }>, alpha: number) => {
      ctx.lineWidth = 2;
      connections.forEach(([a, b]) => {
        const p1 = map.get(a);
        const p2 = map.get(b);
        if (!p1 || !p2) return;
        ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      map.forEach((p) => {
        const color =
          p.v < 0.4 ? `rgba(248, 113, 113, ${alpha})` : p.v < 0.7
            ? `rgba(250, 204, 21, ${alpha})`
            : `rgba(34, 197, 94, ${alpha})`;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const drawEnergy = (map: Map<string, { x: number; y: number; v: number }>, alpha: number) => {
      ctx.strokeStyle = `rgba(251, 146, 60, ${alpha})`;
      ctx.fillStyle = `rgba(251, 146, 60, ${alpha})`;
      ctx.lineWidth = 2;
      energyChains.forEach((chain) => {
        for (let i = 0; i < chain.length - 1; i += 1) {
          const p1 = map.get(chain[i]);
          const p2 = map.get(chain[i + 1]);
          if (!p1 || !p2) continue;
          drawArrow(ctx, p1, p2);
        }
      });
    };

    if (showSkeleton) {
      drawSkeleton(primary, 0.9);
    }
    if (showEnergyFlow) {
      drawEnergy(primary, 0.85);
    }
    if (showComparison && comparison) {
      drawSkeleton(comparison, 0.5);
    }
  }, [primary, comparison, showSkeleton, showEnergyFlow, showComparison, currentFrame, videoWidth, videoHeight]);

  return (
    <div className={containerClassName}>
      <canvas ref={canvasRef} width={videoWidth} height={videoHeight} className="block w-full" />
    </div>
  );
}
