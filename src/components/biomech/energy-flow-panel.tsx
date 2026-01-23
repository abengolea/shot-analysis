"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type ScoreItem = {
  label: string;
  value: number;
  target: string;
};

type TimingItem = {
  segment: string;
  delayMs: number;
  status: "ok" | "warn" | "bad";
};

const scores: ScoreItem[] = [
  { label: "Secuencia correcta", value: 78, target: "30 pts" },
  { label: "Timing óptimo", value: 64, target: "25 pts" },
  { label: "Fluidez", value: 72, target: "20 pts" },
  { label: "Coord. piernas-brazos", value: 58, target: "15 pts" },
  { label: "Set point estable", value: 81, target: "10 pts" },
];

const timing: TimingItem[] = [
  { segment: "Tobillo → Rodilla", delayMs: 42, status: "ok" },
  { segment: "Rodilla → Cadera", delayMs: 68, status: "ok" },
  { segment: "Cadera → Hombro", delayMs: 112, status: "warn" },
  { segment: "Hombro → Codo", delayMs: 145, status: "bad" },
  { segment: "Codo → Muñeca", delayMs: 55, status: "ok" },
];

const recommendations = [
  "Reducir el gap hombro → codo para mejorar la cadena cinética.",
  "Alinear set point para evitar desplazamiento lateral.",
  "Optimizar la fluidez evitando micro-pausas al salir de la carga.",
];

function statusBadge(status: TimingItem["status"]) {
  if (status === "ok") return "bg-emerald-100 text-emerald-800";
  if (status === "warn") return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

export function EnergyFlowPanel() {
  const totalScore = useMemo(
    () => Math.round(scores.reduce((sum, item) => sum + item.value, 0) / scores.length),
    []
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Energy Transfer Score</CardTitle>
        <CardDescription>
          Evaluación de la cadena cinética y timing entre segmentos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Score global</div>
            <Badge className="bg-emerald-100 text-emerald-800">{totalScore} / 100</Badge>
          </div>
          <div className="mt-3">
            <Progress value={totalScore} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {scores.map((item) => (
            <div key={item.label} className="rounded-lg border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground">{item.target}</span>
              </div>
              <div className="mt-3">
                <Progress value={item.value} />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{item.value} / 100</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium">Timing entre segmentos</div>
          <div className="mt-3 grid gap-2 text-sm">
            {timing.map((row) => (
              <div key={row.segment} className="flex items-center justify-between">
                <span>{row.segment}</span>
                <div className="flex items-center gap-2">
                  <Badge className={statusBadge(row.status)}>{row.delayMs} ms</Badge>
                  <span className="text-xs text-muted-foreground">
                    {row.status === "ok"
                      ? "óptimo"
                      : row.status === "warn"
                        ? "ajustar"
                        : "crítico"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium">Recomendaciones prioritarias</div>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
            {recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
