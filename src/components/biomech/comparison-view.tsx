"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

type LayerToggle = {
  id: string;
  label: string;
};

const layers: LayerToggle[] = [
  { id: "skeleton", label: "Esqueleto" },
  { id: "energy", label: "Energía" },
  { id: "angles", label: "Ángulos" },
];

const diffMetrics = [
  { label: "Codo", value: 12 },
  { label: "Hombro", value: 8 },
  { label: "Cadera", value: 15 },
  { label: "Rodilla", value: 10 },
];

export function ComparisonView() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [frame, setFrame] = useState(22);
  const [activeLayers, setActiveLayers] = useState(() => new Set(["skeleton", "energy"]));

  const playbackLabel = useMemo(() => `${speed.toFixed(2)}x`, [speed]);

  const toggleLayer = (id: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparison View</CardTitle>
        <CardDescription>
          Vista comparativa jugador vs modelo óptimo con controles sincronizados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant={isPlaying ? "secondary" : "default"} onClick={() => setIsPlaying((p) => !p)}>
            {isPlaying ? "Pausar" : "Reproducir"}
          </Button>
          <div className="flex items-center gap-2">
            <Label>Velocidad</Label>
            <Badge variant="secondary">{playbackLabel}</Badge>
          </div>
          <div className="min-w-[200px] flex-1">
            <Slider
              value={[speed]}
              min={0.25}
              max={2}
              step={0.25}
              onValueChange={(value) => setSpeed(value[0] ?? 1)}
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Jugador</div>
            <div className="relative aspect-video rounded-lg border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
              <div className="absolute inset-0 grid place-items-center text-xs text-white/70">
                Video jugador
              </div>
              {activeLayers.has("skeleton") && (
                <div className="absolute inset-0 border border-emerald-400/40" />
              )}
              {activeLayers.has("energy") && (
                <div className="absolute inset-0 border border-orange-400/40" />
              )}
              {activeLayers.has("angles") && (
                <div className="absolute inset-0 border border-cyan-400/40" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Modelo óptimo</div>
            <div className="relative aspect-video rounded-lg border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700">
              <div className="absolute inset-0 grid place-items-center text-xs text-white/70">
                Video óptimo
              </div>
              {activeLayers.has("skeleton") && (
                <div className="absolute inset-0 border border-emerald-400/40" />
              )}
              {activeLayers.has("energy") && (
                <div className="absolute inset-0 border border-orange-400/40" />
              )}
              {activeLayers.has("angles") && (
                <div className="absolute inset-0 border border-cyan-400/40" />
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {layers.map((layer) => (
                <div key={layer.id} className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                  <Switch
                    checked={activeLayers.has(layer.id)}
                    onCheckedChange={() => toggleLayer(layer.id)}
                    id={`layer-${layer.id}`}
                  />
                  <Label htmlFor={`layer-${layer.id}`}>{layer.label}</Label>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Frame sincronizado</Label>
              <Slider
                value={[frame]}
                min={0}
                max={60}
                step={1}
                onValueChange={(value) => setFrame(value[0] ?? 0)}
              />
              <div className="text-xs text-muted-foreground">Frame actual: {frame}</div>
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium">Diferencias detectadas</div>
            <div className="mt-3 grid gap-2 text-sm">
              {diffMetrics.map((metric) => (
                <div key={metric.label} className="flex items-center justify-between">
                  <span>{metric.label}</span>
                  <Badge className={metric.value > 12 ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}>
                    {metric.value}°
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
