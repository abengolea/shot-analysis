import { NextRequest, NextResponse } from "next/server";
import { z } from "genkit";
import { ai } from "@/ai/genkit";
import type { EnergyTransferAnalysis } from "@/lib/energy-transfer";

export const dynamic = "force-dynamic";

const EnergyTransferInsightInput = z.object({
  analysis: z.object({
    efficiencyIndex: z.number(),
    fluidityScore: z.number(),
    energyLeakPct: z.number(),
    releaseVsLegsMs: z.number().optional(),
    coveragePct: z.number().optional(),
    dominantSide: z.enum(["left", "right"]).optional(),
    sequence: z.array(
      z.object({
        segment: z.string(),
        status: z.string(),
        delayMs: z.number().optional(),
      })
    ),
  }),
});

const EnergyTransferInsightOutput = z.object({
  summary: z.string(),
  issues: z.array(z.string()),
  recommendations: z.array(z.string()),
  ideal: z.array(z.string()),
});

const energyTransferInsightPrompt = ai.definePrompt({
  name: "energyTransferInsightPrompt",
  input: { schema: EnergyTransferInsightInput },
  output: { schema: EnergyTransferInsightOutput },
  prompt: `Eres un entrenador de basquet especializado en biomecanica.

Vas a explicar la transferencia de energia del lanzamiento en lenguaje simple.
NO inventes numeros. Usa SOLO los datos provistos en el JSON.

JSON:
{{analysis}}

Respuesta JSON:
{
  "summary": "Resumen breve y claro (1-2 frases)",
  "issues": ["Problema principal 1", "Problema principal 2"],
  "recommendations": ["Accion concreta 1", "Accion concreta 2", "Accion concreta 3"],
  "ideal": ["Como llegar al ideal 1", "Como llegar al ideal 2", "Como llegar al ideal 3"]
}

Reglas:
- Si faltan datos (coveragePct bajo o segmentos no detectados), menciona que el analisis es parcial.
- Si releaseVsLegsMs es > 700ms, menciona liberacion tardia.
- Si energyLeakPct > 35, menciona fugas de energia.
- Mantener tono simple, directo y accionable.`,
});

function fallbackInsights(analysis: EnergyTransferAnalysis) {
  const issues: string[] = [];
  if (analysis.energyLeakPct > 35) {
    issues.push("Se detectan fugas de energia entre segmentos.");
  }
  if (analysis.releaseVsLegsMs && analysis.releaseVsLegsMs > 700) {
    issues.push("Liberacion tardia respecto al impulso de piernas.");
  }
  if (analysis.coveragePct < 45) {
    issues.push("Datos de pose incompletos para un diagnostico preciso.");
  }
  if (issues.length === 0) {
    issues.push("No se observan problemas criticos en la secuencia.");
  }

  return {
    summary:
      "Analisis rapido basado en la secuencia de activacion y el timing detectado.",
    issues,
    recommendations: analysis.insights.improvements,
    ideal: analysis.insights.ideal,
  };
}

export async function POST(request: NextRequest) {
  let payload: unknown = null;
  try {
    payload = await request.json();
    const parsed = EnergyTransferInsightInput.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
    }

    const result = await energyTransferInsightPrompt({
      analysis: parsed.data.analysis,
    });

    if (!result.output) {
      throw new Error("Sin respuesta de IA");
    }

    return NextResponse.json({
      source: "ai",
      ...result.output,
    });
  } catch (error) {
    const analysis = (payload as { analysis?: EnergyTransferAnalysis } | null)?.analysis;
    if (analysis) {
      const fallback = fallbackInsights(analysis);
      return NextResponse.json({ source: "fallback", ...fallback });
    }
    console.error("Error generando insights:", error);
    return NextResponse.json({ error: "Error generando insights" }, { status: 500 });
  }
}
