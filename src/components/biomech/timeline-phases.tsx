"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";

type Phase = {
  id: string;
  label: string;
  color: string;
  start: number;
  end: number;
};

const phases: Phase[] = [
  { id: "prep", label: "Preparation", color: "bg-slate-300", start: 0, end: 8 },
  { id: "load", label: "Loading", color: "bg-blue-400", start: 8, end: 18 },
  { id: "ascent", label: "Ascent", color: "bg-emerald-400", start: 18, end: 32 },
  { id: "set", label: "Set Point", color: "bg-yellow-400", start: 32, end: 38 },
  { id: "release", label: "Release", color: "bg-orange-400", start: 38, end: 44 },
  { id: "follow", label: "Follow Through", color: "bg-violet-400", start: 44, end: 60 },
];

const markers = [
  { frame: 12, label: "Carga" },
  { frame: 32, label: "Set point" },
  { frame: 40, label: "Release" },
];

const defaultTotalFrames = 60;

type TimelinePhasesProps = {
  currentFrame?: number;
  totalFrames?: number;
  onFrameChange?: (frame: number) => void;
};

export function TimelinePhases({
  currentFrame,
  totalFrames = defaultTotalFrames,
  onFrameChange,
}: TimelinePhasesProps) {
  const [internalFrame, setInternalFrame] = useState(24);
  const [zoom, setZoom] = useState(1.4);
  const frame = currentFrame ?? internalFrame;
  const setFrame = (next: number | ((prev: number) => number)) => {
    const value = typeof next === "function" ? next(frame) : next;
    if (onFrameChange) {
      onFrameChange(value);
    } else {
      setInternalFrame(value);
    }
  };

  const activePhase = useMemo(
    () => phases.find((phase) => frame >= phase.start && frame <= phase.end),
    [frame]
  );

  const barWidth = Math.round(680 * zoom);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline & Fases</CardTitle>
        <CardDescription>
          Línea de tiempo con fases, marcadores y navegación por frame.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Frame #{frame}</Badge>
          {activePhase && <Badge className="bg-slate-900 text-white">{activePhase.label}</Badge>}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setFrame((prev) => Math.max(0, prev - 1))}>
              -1
            </Button>
            <Button variant="outline" onClick={() => setFrame((prev) => Math.min(totalFrames, prev + 1))}>
              +1
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Zoom</Label>
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.2}
            onValueChange={(value) => setZoom(value[0] ?? 1)}
          />
        </div>

        <ScrollArea className="w-full rounded-lg border">
          <div className="relative h-24 p-4" style={{ width: barWidth }}>
            <div className="relative h-6 overflow-hidden rounded-full bg-muted">
              {phases.map((phase) => {
                const width = ((phase.end - phase.start) / totalFrames) * 100;
                const left = (phase.start / totalFrames) * 100;
                return (
                  <div
                    key={phase.id}
                    className={`absolute h-full ${phase.color}`}
                    style={{ width: `${width}%`, left: `${left}%` }}
                    title={phase.label}
                  />
                );
              })}
            </div>
            <div className="relative mt-4 h-6">
              {markers.map((marker) => {
                const left = (marker.frame / totalFrames) * 100;
                return (
                  <button
                    key={marker.frame}
                    type="button"
                    className="absolute -top-1 flex flex-col items-center text-xs text-muted-foreground"
                    style={{ left: `${left}%` }}
                    onClick={() => setFrame(marker.frame)}
                  >
                    <span className="h-3 w-0.5 bg-foreground/70" />
                    {marker.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="absolute top-4 h-10 w-0.5 bg-foreground"
              style={{ left: `${(frame / totalFrames) * 100}%` }}
            />
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <div className="space-y-2">
          <Label>Scrub</Label>
          <Slider
            value={[frame]}
            min={0}
            max={totalFrames}
            step={1}
            onValueChange={(value) => setFrame(value[0] ?? 0)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
