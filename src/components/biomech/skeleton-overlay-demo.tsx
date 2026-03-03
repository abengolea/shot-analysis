"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { SkeletonOverlay, type Keypoint } from "@/components/biomech/skeleton-overlay";

const videoSize = { width: 640, height: 360 };

const baseKeypoints: Record<string, { x: number; y: number }> = {
  left_shoulder: { x: 0.42, y: 0.28 },
  right_shoulder: { x: 0.58, y: 0.28 },
  left_elbow: { x: 0.36, y: 0.4 },
  right_elbow: { x: 0.64, y: 0.4 },
  left_wrist: { x: 0.32, y: 0.52 },
  right_wrist: { x: 0.68, y: 0.52 },
  left_hip: { x: 0.45, y: 0.52 },
  right_hip: { x: 0.55, y: 0.52 },
  left_knee: { x: 0.44, y: 0.72 },
  right_knee: { x: 0.56, y: 0.72 },
  left_ankle: { x: 0.43, y: 0.9 },
  right_ankle: { x: 0.57, y: 0.9 },
};

function buildKeypoints(frame: number, offset = 0): Keypoint[] {
  const wobble = Math.sin(frame / 8) * 0.02;
  const lift = Math.cos(frame / 10) * 0.03;
  return Object.entries(baseKeypoints).map(([name, point]) => ({
    name,
    x: point.x + wobble + offset,
    y: point.y - lift,
    visibility: 0.85,
  }));
}

export function SkeletonOverlayDemo() {
  const [frame, setFrame] = useState(24);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showEnergy, setShowEnergy] = useState(true);
  const [showComparison, setShowComparison] = useState(false);

  const keypoints = useMemo(() => buildKeypoints(frame), [frame]);
  const comparison = useMemo(() => buildKeypoints(frame, 0.03), [frame]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Skeleton Overlay</CardTitle>
        <CardDescription>
          Visualización de keypoints y flujo energético sobre el video.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Frame #{frame}</Badge>
          <div className="flex items-center gap-2">
            <Switch
              checked={showSkeleton}
              onCheckedChange={(value) => setShowSkeleton(Boolean(value))}
              id="toggle-skeleton"
            />
            <Label htmlFor="toggle-skeleton">Esqueleto</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={showEnergy}
              onCheckedChange={(value) => setShowEnergy(Boolean(value))}
              id="toggle-energy"
            />
            <Label htmlFor="toggle-energy">Energía</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={showComparison}
              onCheckedChange={(value) => setShowComparison(Boolean(value))}
              id="toggle-comparison"
            />
            <Label htmlFor="toggle-comparison">Comparación</Label>
          </div>
        </div>

        <SkeletonOverlay
          keypoints={keypoints}
          comparisonKeypoints={comparison}
          videoWidth={videoSize.width}
          videoHeight={videoSize.height}
          currentFrame={frame}
          showSkeleton={showSkeleton}
          showEnergyFlow={showEnergy}
          showComparison={showComparison}
        />

        <div className="space-y-2">
          <Label>Timeline mock</Label>
          <Slider
            value={[frame]}
            min={0}
            max={60}
            step={1}
            onValueChange={(value) => setFrame(value[0] ?? 0)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
