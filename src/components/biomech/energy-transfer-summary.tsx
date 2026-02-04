"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  analyzeEnergyTransfer,
  formatMs,
  getSegmentLabel,
  type PoseFrame,
  type EnergyTransferStatus,
} from "@/lib/energy-transfer";

type EnergyTransferSummaryProps = {
  poseFrames?: PoseFrame[] | null;
};

type AdvancedInsights = {
  source?: string;
  summary: string;
  issues: string[];
  recommendations: string[];
  ideal: string[];
};

const idealTimingRanges: Record<
  "piernas" | "cadera" | "tronco" | "brazo" | "muneca",
  { min: number; max: number }
> = {
  piernas: { min: 0, max: 80 },
  cadera: { min: 80, max: 200 },
  tronco: { min: 160, max: 280 },
  brazo: { min: 240, max: 360 },
  muneca: { min: 320, max: 520 },
};

const timingStatusStyle: Record<"ok" | "warn" | "bad" | "na", string> = {
  ok: "bg-emerald-100 text-emerald-800",
  warn: "bg-yellow-100 text-yellow-800",
  bad: "bg-red-100 text-red-800",
  na: "bg-slate-100 text-slate-700",
};

const statusStyle: Record<EnergyTransferStatus, string> = {
  correcto: "bg-emerald-100 text-emerald-800",
  mejorable: "bg-yellow-100 text-yellow-800",
  incorrecto: "bg-red-100 text-red-800",
  no_detectado: "bg-slate-100 text-slate-700",
};

export function EnergyTransferSummary({ poseFrames }: EnergyTransferSummaryProps) {
  const analysis = useMemo(
    () => analyzeEnergyTransfer(poseFrames ?? []),
    [poseFrames]
  );
  const [advancedInsights, setAdvancedInsights] = useState<AdvancedInsights | null>(null);
  const [advancedLoading, setAdvancedLoading] = useState(false);
  const [advancedError, setAdvancedError] = useState<string | null>(null);

  useEffect(() => {
    if (!analysis) return;
    let active = true;
    const controller = new AbortController();

    const loadInsights = async () => {
      setAdvancedLoading(true);
      setAdvancedError(null);
      try {
        const res = await fetch("/api/biomech/energy-transfer/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysis }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("No se pudieron generar insights");
        }
        const data = (await res.json()) as AdvancedInsights;
        if (active) {
          setAdvancedInsights(data);
        }
      } catch (err) {
        if (active) {
          setAdvancedError(
            err instanceof Error ? err.message : "No se pudieron generar insights"
          );
        }
      } finally {
        if (active) {
          setAdvancedLoading(false);
        }
      }
    };

    loadInsights();
    return () => {
      active = false;
      controller.abort();
    };
  }, [analysis]);

  if (!poseFrames || poseFrames.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transferencia de energia (IA)</CardTitle>
          <CardDescription>Analisis automatico basado en la pose.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Aun no hay datos de pose para evaluar la transferencia de energia.
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transferencia de energia (IA)</CardTitle>
          <CardDescription>Analisis automatico basado en la pose.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No se pudo calcular un resumen confiable con los datos actuales.
        </CardContent>
      </Card>
    );
  }

  const t0 = analysis.t0Ms ?? 0;
  const timingRows = analysis.sequence
    .map((segment) => {
      const ideal = idealTimingRanges[segment.segment];
      if (!ideal || typeof segment.onsetMs !== "number") {
        return {
          ...segment,
          offsetMs: null as number | null,
          status: "na" as const,
          ideal,
        };
      }
      const offsetMs = Math.max(0, Math.round(segment.onsetMs - t0));
      let status: "ok" | "warn" | "bad" = "ok";
      if (offsetMs < ideal.min - 60 || offsetMs > ideal.max + 60) {
        status = "bad";
      } else if (offsetMs < ideal.min || offsetMs > ideal.max) {
        status = "warn";
      }
      return { ...segment, offsetMs, status, ideal };
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transferencia de energia (IA)</CardTitle>
        <CardDescription>
          Secuencia y timing para acercarte al ideal biomecanico.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Score global</span>
            <Badge className="bg-emerald-100 text-emerald-800">
              {analysis.efficiencyIndex} / 100
            </Badge>
          </div>
          <div className="mt-3">
            <Progress value={analysis.efficiencyIndex} />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Dominante: {analysis.dominantSide === "right" ? "derecha" : "izquierda"} ·
            Cobertura {analysis.coveragePct}%
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Fluidez</div>
            <div className="text-lg font-semibold">{analysis.fluidityScore} / 100</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Perdidas de energia</div>
            <div className="text-lg font-semibold">{analysis.energyLeakPct}%</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Release vs piernas</div>
            <div className="text-lg font-semibold">{analysis.releaseVsLegsMs ?? "N/A"} ms</div>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium">Secuencia detectada</div>
          <div className="mt-3 grid gap-2 text-sm">
            {analysis.sequence.map((segment) => (
              <div key={segment.segment} className="flex items-center justify-between">
                <span>{getSegmentLabel(segment.segment)}</span>
                <div className="flex items-center gap-2">
                  <Badge className={statusStyle[segment.status]}>{segment.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {segment.delayMs ? `+${segment.delayMs}ms` : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Set point: {formatMs(analysis.setPointMs)} · Release: {formatMs(analysis.releaseMs)}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium">Timing vs ideal (ms)</div>
          <div className="mt-3 grid gap-2 text-sm">
            {timingRows.map((row) => (
              <div key={row.segment} className="flex items-center justify-between">
                <span>{getSegmentLabel(row.segment)}</span>
                <div className="flex items-center gap-2">
                  <Badge className={timingStatusStyle[row.status]}>
                    {row.offsetMs !== null ? `${row.offsetMs}ms` : "N/A"}
                  </Badge>
                  {row.ideal && (
                    <span className="text-xs text-muted-foreground">
                      ideal {row.ideal.min}-{row.ideal.max}ms
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Referencia: tiempos medidos desde el inicio de piernas (t0).
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium">Fortalezas</div>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
              {analysis.insights.strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium">Ajustes prioritarios</div>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
              {analysis.insights.improvements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium">IA avanzada</div>
          {advancedLoading && (
            <div className="mt-2 text-xs text-muted-foreground">
              Generando analisis narrativo...
            </div>
          )}
          {advancedError && (
            <div className="mt-2 text-xs text-red-600">{advancedError}</div>
          )}
          <div className="mt-3 text-sm text-muted-foreground">
            {advancedInsights?.summary ||
              "Analisis basado en la secuencia de activacion y el timing detectado."}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium">Problemas clave</div>
              <ul className="mt-2 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
                {(advancedInsights?.issues ?? analysis.insights.improvements).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-sm font-medium">Acciones recomendadas</div>
              <ul className="mt-2 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
                {(advancedInsights?.recommendations ?? analysis.insights.improvements).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-medium">Como llegar al ideal</div>
            <ul className="mt-2 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
              {(advancedInsights?.ideal ?? analysis.insights.ideal).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {advancedInsights?.source === "fallback" && (
            <div className="mt-3 text-xs text-muted-foreground">
              Modo fallback activo: se uso analisis determinista.
            </div>
          )}
        </div>

        {analysis.warnings.length > 0 && (
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            {analysis.warnings.join(" ")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
