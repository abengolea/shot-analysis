import { ai } from '@/ai/genkit';

type SummaryInput = {
  baseSummary?: string;
  verificacion_inicial?: {
    duracion_video?: string;
    mano_tiro?: string;
    salta?: boolean;
    canasta_visible?: boolean;
    angulo_camara?: string;
    elementos_entorno?: string[];
  };
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  resumen_evaluacion?: {
    parametros_evaluados?: number;
    parametros_no_evaluables?: number;
    lista_no_evaluables?: string[];
    score_global?: number;
    confianza_analisis?: string;
  };
  shots?: {
    total: number;
    byLabel: Array<{ label: string; count: number }>;
  };
};

const safeList = (input?: string[], limit = 4) =>
  Array.isArray(input) ? input.filter(Boolean).slice(0, limit) : [];

export async function generateAnalysisSummary(input: SummaryInput): Promise<string | null> {
  try {
    const shotsText = input.shots
      ? `total=${input.shots.total}, por video=${input.shots.byLabel.map((s) => `${s.label}:${s.count}`).join(', ')}`
      : 'no disponible';

    const baseSummaryRaw = input.baseSummary || '';
    const baseSummary =
      /no detectamos|no se pudo confirmar|no evaluable/i.test(baseSummaryRaw)
        ? ''
        : baseSummaryRaw;
    const payload = {
      verificacion_inicial: input.verificacion_inicial || {},
      strengths: safeList(input.strengths),
      weaknesses: safeList(input.weaknesses),
      recommendations: safeList(input.recommendations),
      resumen_evaluacion: {
        parametros_evaluados: input.resumen_evaluacion?.parametros_evaluados,
        parametros_no_evaluables: input.resumen_evaluacion?.parametros_no_evaluables,
        lista_no_evaluables: input.resumen_evaluacion?.lista_no_evaluables,
        confianza_analisis: input.resumen_evaluacion?.confianza_analisis,
      },
      shots: shotsText,
      baseSummary,
    };

    const prompt = `Eres un entrenador de básquet y debes redactar un resumen FINAL del análisis.

REGLAS OBLIGATORIAS:
1) Usa SOLO la información provista en el JSON.
2) Menciona la cantidad real de tiros y la distribución por video.
3) No digas "un tiro" si el conteo es mayor.
4) Si el JSON no trae un dato, di que no es verificable; NUNCA inventes.
5) Si shots.total = 0, NO describas mano, ángulo, aro o ejecución técnica.
6) Si hay parámetros no evaluables, mencioná la limitación.
7) NO menciones puntajes, score global ni nivel de confianza.
8) NO uses segundos, timestamps ni rangos temporales.
9) Texto en español, 5 a 8 oraciones, claro y profesional.

JSON:
${JSON.stringify(payload)}

Devuelve SOLO el texto del resumen.`;

    const result = await ai.generate([{ text: prompt }]);
    const text = (result as any)?.outputText ?? (result as any)?.text ?? '';
    const cleaned = String(text || '').trim();
    return cleaned.length > 0 ? cleaned : null;
  } catch (e) {
    console.warn('[generateAnalysisSummary] fallo', e);
    return null;
  }
}
