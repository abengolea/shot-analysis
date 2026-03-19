#!/usr/bin/env npx tsx
/**
 * Script para probar los flujos de IA/Gemini sin necesidad de subir videos ni probar cada uno manualmente.
 *
 * Ejecutar: npm run test:gemini
 * Requiere: GEMINI_API_KEY o GOOGLE_GENAI_API_KEY en .env o .env.local
 *
 * Prueba:
 * - Direct Gemini API (gemini-3.1-flash-lite-preview)
 * - Flujos Genkit solo-texto: moderateContent, rewriteCoachComment, generateCoachSummary,
 *   reviewChat, generatePersonalizedDrills
 *
 * No prueba (requieren video): analyzeBasketballShot, detectStartFrame, detectEndFrame,
 * validateBasketballContent, processUploadedVideo, analyzeVideoFrames, etc.
 */

import { config } from 'dotenv';

// Cargar variables de entorno antes de cualquier import
config();
config({ path: '.env.local', override: true });

const API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY;

const TIMEOUT_MS = 45_000;

type TestResult = { name: string; ok: boolean; duration: number; error?: string };

async function runWithTimeout<T>(fn: () => Promise<T>, name: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout después de ${TIMEOUT_MS / 1000}s`));
    }, TIMEOUT_MS);
    fn()
      .then((r) => {
        clearTimeout(timer);
        resolve(r);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

async function testDirectGemini(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
    const result = await model.generateContent('Responde solo: OK');
    const text = result.response.text();
    if (!text || text.length < 1) throw new Error('Respuesta vacía');
    return { name: 'Direct Gemini API (3.1 Flash Lite)', ok: true, duration: Date.now() - start };
  } catch (e: any) {
    return {
      name: 'Direct Gemini API (3.1 Flash Lite)',
      ok: false,
      duration: Date.now() - start,
      error: e?.message || String(e),
    };
  }
}

async function testModerateContent(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { moderateContent } = await import('@/ai/flows/content-moderation');
    const result = await runWithTimeout(
      () => moderateContent({ text: 'Hola, este es un mensaje de prueba inofensivo.' }),
      'moderateContent'
    );
    if (typeof result?.isHarmful !== 'boolean') throw new Error('Respuesta inválida');
    return { name: 'moderateContentFlow', ok: true, duration: Date.now() - start };
  } catch (e: any) {
    return {
      name: 'moderateContentFlow',
      ok: false,
      duration: Date.now() - start,
      error: e?.message || String(e),
    };
  }
}

async function testRewriteCoachComment(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { rewriteCoachComment } = await import('@/ai/flows/rewrite-coach-comment');
    const result = await runWithTimeout(
      () => rewriteCoachComment({ text: 'El jugador tiene que mejorar el codo.' }),
      'rewriteCoachComment'
    );
    if (!result?.improved || typeof result.improved !== 'string')
      throw new Error('Respuesta inválida');
    return { name: 'rewriteCoachCommentFlow', ok: true, duration: Date.now() - start };
  } catch (e: any) {
    return {
      name: 'rewriteCoachCommentFlow',
      ok: false,
      duration: Date.now() - start,
      error: e?.message || String(e),
    };
  }
}

async function testGenerateCoachSummary(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { generateCoachSummary } = await import('@/ai/flows/generate-coach-summary');
    const result = await runWithTimeout(
      () =>
        generateCoachSummary({
          analysisSummary: 'Buen tiro, fluidez correcta.',
          shotType: 'jump_shot',
        }),
      'generateCoachSummary'
    );
    if (!result?.summary || typeof result.summary !== 'string')
      throw new Error('Respuesta inválida');
    return { name: 'generateCoachSummaryFlow', ok: true, duration: Date.now() - start };
  } catch (e: any) {
    return {
      name: 'generateCoachSummaryFlow',
      ok: false,
      duration: Date.now() - start,
      error: e?.message || String(e),
    };
  }
}

async function testReviewChat(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { reviewChatFlow } = await import('@/ai/flows/review-chat');
    const result = await runWithTimeout(
      () =>
        reviewChatFlow({
          analysisSummary: 'Análisis de prueba.',
          detailedChecklist: '[]',
          message: '¿Qué aspectos debería priorizar?',
        }),
      'reviewChatFlow'
    );
    if (!result?.reply || typeof result.reply !== 'string') throw new Error('Respuesta inválida');
    return { name: 'reviewChatFlow', ok: true, duration: Date.now() - start };
  } catch (e: any) {
    return {
      name: 'reviewChatFlow',
      ok: false,
      duration: Date.now() - start,
      error: e?.message || String(e),
    };
  }
}

async function testGeneratePersonalizedDrills(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { generatePersonalizedDrills } = await import(
      '@/ai/flows/generate-personalized-drills'
    );
    const result = await runWithTimeout(
      () =>
        generatePersonalizedDrills({
          analysisJson: JSON.stringify({
            weaknesses: ['alineación de pies', 'extensión de brazo'],
            strengths: ['fluidez'],
          }),
          resources: 'pelota, conos',
          ageGroup: 'U15',
        }),
      'generatePersonalizedDrills'
    );
    if (!result?.drills || !Array.isArray(result.drills)) throw new Error('Respuesta inválida');
    return { name: 'generatePersonalizedDrillsFlow', ok: true, duration: Date.now() - start };
  } catch (e: any) {
    return {
      name: 'generatePersonalizedDrillsFlow',
      ok: false,
      duration: Date.now() - start,
      error: e?.message || String(e),
    };
  }
}

async function main() {
  console.log('\n🧪 Prueba de flujos Gemini / IA\n');
  console.log('─'.repeat(50));

  if (!API_KEY) {
    console.error('❌ Falta GEMINI_API_KEY o GOOGLE_GENAI_API_KEY en .env o .env.local');
    process.exit(1);
  }

  const tests: Array<{ name: string; fn: () => Promise<TestResult> }> = [
    { name: 'Direct Gemini API (3.1 Flash Lite)', fn: testDirectGemini },
    { name: 'moderateContentFlow', fn: testModerateContent },
    { name: 'rewriteCoachCommentFlow', fn: testRewriteCoachComment },
    { name: 'generateCoachSummaryFlow', fn: testGenerateCoachSummary },
    { name: 'reviewChatFlow', fn: testReviewChat },
    { name: 'generatePersonalizedDrillsFlow', fn: testGeneratePersonalizedDrills },
  ];

  const results: TestResult[] = [];
  for (const { name, fn } of tests) {
    process.stdout.write(`  ${name}... `);
    const r = await fn();
    results.push(r);
    if (r.ok) {
      console.log(`✅ ${(r.duration / 1000).toFixed(1)}s`);
    } else {
      console.log(`❌ ${r.error}`);
    }
  }

  console.log('─'.repeat(50));
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n📊 Resultado: ${passed} OK, ${failed} fallidos\n`);

  if (failed > 0) {
    console.log('Errores:');
    results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
    process.exit(1);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error('Error fatal:', e);
  process.exit(1);
});
