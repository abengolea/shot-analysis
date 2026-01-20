"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getAuth, getIdToken } from "firebase/auth";
import { VideoPlayer } from "@/components/video-player";
import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

type IssueId =
  | 'set_point'
  | 'alineacion_codo'
  | 'base_pies'
  | 'timing'
  | 'tronco_postura'
  | 'mirada_enfoque'
  | 'trayectoria_brazo'
  | 'equilibrio_salto'
  | 'mano_no_dominante_ascenso'
  | 'mano_no_dominante_liberacion'
  | 'liberacion_muneca'
  | 'alineacion_pies_hombros'
  | 'finalizacion'
  | 'otros';

type Severity = 'bajo' | 'medio' | 'alto';

type SelectedIssue = {
  id: IssueId;
  severity?: Severity;
  rating?: 1 | 2 | 3 | 4 | 5;
  commentForAI?: string;
};

const ISSUE_OPTIONS: { id: IssueId; label: string }[] = [
  { id: 'set_point', label: 'Set point' },
  { id: 'alineacion_codo', label: 'Alineación del codo' },
  { id: 'base_pies', label: 'Base de pies' },
  { id: 'timing', label: 'Timing' },
  { id: 'tronco_postura', label: 'Tronco / Postura' },
  { id: 'mirada_enfoque', label: 'Mirada / Enfoque' },
  { id: 'trayectoria_brazo', label: 'Trayectoria del brazo' },
  { id: 'equilibrio_salto', label: 'Equilibrio / Salto' },
  { id: 'mano_no_dominante_ascenso', label: 'Mano no dominante (ascenso)' },
  { id: 'mano_no_dominante_liberacion', label: 'Mano no dominante (liberación)' },
  { id: 'liberacion_muneca', label: 'Liberación muñeca' },
  { id: 'alineacion_pies_hombros', label: 'Alineación pies-hombros' },
  { id: 'finalizacion', label: 'Finalización' },
  { id: 'otros', label: 'Otros' },
];

type Analysis = {
  id: string;
  playerId: string;
  createdAt: string;
  shotType?: string;
  score?: number;
  videoUrl?: string | null;
  videoFrontUrl?: string | null;
  videoBackUrl?: string | null;
  videoLeftUrl?: string | null;
  videoRightUrl?: string | null;
  // Campos IA (opcionales) que pueden venir en el documento raíz
  analysisSummary?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  detailedChecklist?: any[];
  // Alternativamente, algunos análisis pueden venir anidados en analysisResult
  analysisResult?: {
    analysisSummary?: string;
    strengths?: string[];
    weaknesses?: string[];
    recommendations?: string[];
    detailedChecklist?: any[];
    advertencia?: string;
  } | null;
  advertencia?: string;
};

export default function AdminRevisionIADetailPage() {
  const params = useParams<{ id: string }>();
  const analysisId = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [selectedIssueId, setSelectedIssueId] = useState<IssueId>('alineacion_codo');
  const [issues, setIssues] = useState<SelectedIssue[]>([]);
  // Campos de frames ocultos por pedido: mantenemos estado interno pero no mostramos UI
  const [startFrame, setStartFrame] = useState<string>("");
  const [endFrame, setEndFrame] = useState<string>("");
  const [commentForAI, setCommentForAI] = useState<string>("");
  const [statusListo, setStatusListo] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [angle, setAngle] = useState<'auto'|'back'|'front'|'left'|'right'>('auto');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; role: 'user'|'assistant'; text: string; attachments?: string[] }>>([]);
  const [selectedCatIdx, setSelectedCatIdx] = useState<number | null>(null);
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [recentThumbs, setRecentThumbs] = useState<string[]>([]);
  const [approvedExamples, setApprovedExamples] = useState<Record<string, boolean>>({});
  const [questioned, setQuestioned] = useState<Record<string, boolean>>({});

  const issueMap = useMemo(() => Object.fromEntries(ISSUE_OPTIONS.map(o => [o.id, o.label])), []);
  const isNonBasketballAnalysis = (input: Analysis | null) => {
    if (!input) return false;
    const warning = input.advertencia || input.analysisResult?.advertencia || '';
    const summary = input.analysisSummary || input.analysisResult?.analysisSummary || '';
    const text = `${warning} ${summary}`.toLowerCase();
    return /no corresponde a basquet|no detectamos/.test(text);
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const auth = getAuth();
      const cu = auth.currentUser;
      if (!cu) throw new Error('Usuario no autenticado');
      const token = await getIdToken(cu, true);
      // analysis
      const resA = await fetch(`/api/analyses/${encodeURIComponent(analysisId)}?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dataA = await resA.json();
      if (!resA.ok) throw new Error(dataA?.error || `HTTP ${resA.status}`);
      const a = dataA?.analysis || null;
      if (a) {
        setAnalysis({ 
          id: String(a.id), 
          playerId: String(a.playerId), 
          createdAt: String(a.createdAt), 
          shotType: a.shotType, 
          score: typeof a.score === 'number' ? a.score : undefined,
          videoUrl: a.videoUrl || null,
          videoFrontUrl: a.videoFrontUrl || null,
          videoBackUrl: a.videoBackUrl || null,
          videoLeftUrl: a.videoLeftUrl || null,
          videoRightUrl: a.videoRightUrl || null,
          // Copiar campos IA si existen (raíz o analysisResult)
          analysisSummary: a.analysisSummary,
          strengths: Array.isArray(a.strengths) ? a.strengths : undefined,
          weaknesses: Array.isArray(a.weaknesses) ? a.weaknesses : undefined,
          recommendations: Array.isArray(a.recommendations) ? a.recommendations : undefined,
          detailedChecklist: Array.isArray(a.detailedChecklist) ? a.detailedChecklist : undefined,
          analysisResult: a.analysisResult || null,
          advertencia: a.advertencia || a.analysisResult?.advertencia,
        });
        setPlayerId(String(a.playerId || ''));
      }
      // existing feedback
      const resF = await fetch(`/api/analyses/${encodeURIComponent(analysisId)}/admin-feedback`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dataF = await resF.json();
      if (resF.ok && dataF?.feedback) {
        const f = dataF.feedback as any;
        setIssues(Array.isArray(f.issues) ? f.issues : []);
        setStartFrame(typeof f?.corrections?.startFrame === 'number' ? String(f.corrections.startFrame) : "");
        setEndFrame(typeof f?.corrections?.endFrame === 'number' ? String(f.corrections.endFrame) : "");
        setCommentForAI(typeof f?.commentForAI === 'string' ? f.commentForAI : "");
        setStatusListo(f?.status === 'listo');
      }
    } catch (e: any) {
      setError(e?.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (analysisId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId]);

  const loadChat = async () => {
    try {
      setChatLoading(true);
      setChatError(null);
      const auth = getAuth();
      const cu = auth.currentUser;
      if (!cu) throw new Error('Usuario no autenticado');
      const token = await getIdToken(cu, true);
      const res = await fetch(`/api/analyses/${encodeURIComponent(analysisId)}/chat`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setChatMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (e:any) {
      setChatError(e?.message || 'Error desconocido');
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => { if (analysisId) loadChat(); /* eslint-disable-next-line */ }, [analysisId]);

  // Subida reutilizable de imágenes (archivos) al Storage
  const uploadFiles = async (files: File[]) => {
    try {
      const validFiles = files.filter((f) => f && f.type && f.type.startsWith('image/'));
      if (!validFiles.length) return;
      setUploading(true);
      const uploaded: string[] = [];
      for (const f of validFiles) {
        const path = `analyses/${encodeURIComponent(analysisId)}/admin_chat/${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name || 'clip.png'}`;
        const r = storageRef(storage, path);
        await uploadBytes(r, f);
        const url = await getDownloadURL(r);
        uploaded.push(url);
      }
      if (uploaded.length) setAttachments((prev) => [...prev, ...uploaded]);
      if (uploaded.length) {
        const plural = uploaded.length > 1 ? 'imágenes' : 'imagen';
        setUploadNotice(`Se agregó ${uploaded.length} ${plural}`);
        setTimeout(() => setUploadNotice(null), 3000);
        setRecentThumbs(uploaded);
        setTimeout(() => setRecentThumbs([]), 3000);
      }
    } catch (err) {
      console.error('upload error', err);
      setChatError('Error subiendo imágenes');
    } finally {
      setUploading(false);
    }
  };

  const addIssue = () => {
    setIssues((prev) => {
      if (prev.find((p) => p.id === selectedIssueId)) return prev;
      return [...prev, { id: selectedIssueId }];
    });
  };

  const updateIssue = (id: IssueId, patch: Partial<SelectedIssue>) => {
    setIssues((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeIssue = (id: IssueId) => {
    setIssues((prev) => prev.filter((it) => it.id !== id));
  };

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      const auth = getAuth();
      const cu = auth.currentUser;
      if (!cu) throw new Error('Usuario no autenticado');
      const token = await getIdToken(cu, true);
      const body = {
        playerId,
        issues,
        corrections: {
          startFrame: startFrame ? Number(startFrame) : undefined,
          endFrame: endFrame ? Number(endFrame) : undefined,
        },
        commentForAI,
        status: statusListo ? 'listo' : 'borrador',
      };
      const res = await fetch(`/api/analyses/${encodeURIComponent(analysisId)}/admin-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    } catch (e: any) {
      setError(e?.message || 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  const reanalyze = async () => {
    try {
      setSaving(true);
      setError(null);
      const auth = getAuth();
      const cu = auth.currentUser;
      if (!cu) throw new Error('Usuario no autenticado');
      const token = await getIdToken(cu, true);
      const res = await fetch(`/api/analyses/${encodeURIComponent(analysisId)}/reanalyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    } catch (e: any) {
      setError(e?.message || 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Revisión IA — Detalle</h1>
        <Link className="text-blue-600 underline" href="/admin/revision-ia">Volver</Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {analysis && (
        <div className="rounded border p-4 space-y-4 text-sm">
          {(() => {
            const checklistAll = (((analysis as any)?.detailedChecklist) || ((analysis as any)?.analysisResult?.detailedChecklist) || []) as any[];
            const flatItems: any[] = checklistAll.flatMap((c: any) => Array.isArray(c?.items) ? c.items : []);
            const isEvaluable = (item: any) => !item?.na && item?.status !== 'no_evaluable';
            const strengthsFromChecklist: string[] = flatItems
              .filter((it: any) => isEvaluable(it) && (typeof it.rating === 'number' ? it.rating >= 4 : (it.status === 'Correcto' || it.status === 'Excelente')))
              .sort((a: any, b: any) => (Number(b?.rating ?? 3) - Number(a?.rating ?? 3)))
              .map((it: any) => String(it?.name || it?.id))
              .filter(Boolean);
            const weaknessesFromChecklist: string[] = flatItems
              .filter((it: any) => isEvaluable(it) && (typeof it.rating === 'number' ? it.rating <= 2 : (it.status === 'Incorrecto' || it.status === 'Incorrecto leve')))
              .sort((a: any, b: any) => (Number(a?.rating ?? 3) - Number(b?.rating ?? 3)))
              .map((it: any) => String(it?.name || it?.id))
              .filter(Boolean);
            const recommendationsFromChecklist: string[] = flatItems
              .filter((it: any) =>
                isEvaluable(it) &&
                (typeof it.rating === 'number' ? it.rating <= 3 : (it.status === 'Mejorable' || it.status === 'Incorrecto' || it.status === 'Incorrecto leve'))
              )
              .sort((a: any, b: any) => {
                const ra = Number(a?.rating ?? 3); const rb = Number(b?.rating ?? 3);
                if (ra !== rb) return ra - rb; // peor primero
                const la = String(a?.comment || '').length; const lb = String(b?.comment || '').length;
                return lb - la; // comentario más sustancioso primero
              })
              .map((it: any) => `Trabajar: ${String(it?.name || it?.id)}`)
              .filter(Boolean);

            const aiSummary = (analysis as any)?.analysisResult?.analysisSummary || (analysis as any)?.analysisSummary || '';
            const aiStrengths: string[] = ((analysis as any)?.analysisResult?.strengths || (analysis as any)?.strengths || strengthsFromChecklist || []) as string[];
            const aiWeaknesses: string[] = ((analysis as any)?.analysisResult?.weaknesses || (analysis as any)?.weaknesses || weaknessesFromChecklist || []) as string[];
            const aiRecommendations: string[] = ((analysis as any)?.analysisResult?.recommendations || (analysis as any)?.recommendations || recommendationsFromChecklist || []) as string[];
            const nonBasketball = isNonBasketballAnalysis(analysis);
            const filteredStrengths = nonBasketball ? [] : aiStrengths;
            const filteredWeaknesses = nonBasketball ? [] : aiWeaknesses;
            const filteredRecommendations = nonBasketball ? [] : aiRecommendations;

            // Guardar en variables globales del closure para usar en el JSX siguiente
            (analysis as any).__derived = {
              aiSummary,
              aiStrengths: filteredStrengths,
              aiWeaknesses: filteredWeaknesses,
              aiRecommendations: filteredRecommendations,
              checklistAll
            };
            return null;
          })()}
          <div className="space-y-1">
            <div><span className="font-semibold">Análisis:</span> {analysis.id}</div>
            <div><span className="font-semibold">Jugador:</span> {analysis.playerId}</div>
            <div><span className="font-semibold">Fecha:</span> {new Date(analysis.createdAt).toLocaleString()}</div>
            <div><span className="font-semibold">Tipo:</span> {analysis.shotType || '-'}</div>
            <div><span className="font-semibold">Score:</span> {typeof analysis.score === 'number' ? analysis.score : '-'}</div>
          </div>

          {/* Video Review */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm">Ángulo</label>
              <select className="rounded border px-2 py-1" value={angle} onChange={(e)=>setAngle(e.target.value as any)}>
                <option value="auto">Auto</option>
                <option value="back">Back</option>
                <option value="front">Front</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
            <VideoPlayer 
              src={
                (angle === 'back' && (analysis.videoBackUrl || analysis.videoUrl)) ||
                (angle === 'front' && (analysis.videoFrontUrl || analysis.videoUrl)) ||
                (angle === 'left' && (analysis.videoLeftUrl || analysis.videoUrl)) ||
                (angle === 'right' && (analysis.videoRightUrl || analysis.videoUrl)) ||
                analysis.videoUrl || analysis.videoBackUrl || analysis.videoFrontUrl || analysis.videoLeftUrl || analysis.videoRightUrl || ''
              }
              onFrameChange={(t, f) => { setCurrentTime(t); setCurrentFrame(f); }}
            />
            <div className="text-xs text-muted-foreground">Tiempo actual: {currentTime.toFixed(2)}s · Frame: {currentFrame}</div>
          </div>

          {/* Resumen y Checklist de la IA (debajo del video) */}
          <div className="space-y-3">
            <h3 className="text-base font-medium">Qué dijo la IA</h3>
            <div className="rounded border p-3 bg-slate-50">
              <div className="text-sm whitespace-pre-wrap">{(analysis as any).__derived?.aiSummary || 'Sin resumen'}</div>
              <div className="mt-2">
                <button
                  className="text-xs text-blue-600 underline"
                  onClick={() => {
                    const txt = (analysis as any).__derived?.aiSummary || '';
                    setChatInput(txt ? `No estoy de acuerdo con el resumen: "${txt.slice(0, 140)}..." ` : 'No estoy de acuerdo con el resumen: ');
                    document.getElementById('review-chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setTimeout(() => chatInputRef.current?.focus(), 150);
                    setQuestioned((prev) => ({ ...prev, summary: true }));
                  }}
                  disabled={questioned['summary'] === true}
                >
                  {questioned['summary'] === true ? 'CUESTIONADO' : 'Cuestionar resumen'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded border p-3 bg-white">
                <div className="text-sm font-medium mb-2">Fortalezas</div>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {Array.isArray((analysis as any).__derived?.aiStrengths) && (analysis as any).__derived.aiStrengths.length
                    ? (analysis as any).__derived.aiStrengths.map((s: string, i: number) => (
                        <li key={`str-${i}`} className="flex items-start justify-between gap-2">
                          <span>{s}</span>
                          <button
                            className="text-xs text-blue-600 underline whitespace-nowrap"
                            onClick={() => {
                              setChatInput(`No estoy de acuerdo con la fortaleza "${s}": `);
                              document.getElementById('review-chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              setTimeout(() => chatInputRef.current?.focus(), 150);
                              setQuestioned((prev) => ({ ...prev, [`strength:${s}`]: true }));
                            }}
                            disabled={questioned[`strength:${s}`] === true}
                          >
                            {questioned[`strength:${s}`] === true ? 'CUESTIONADO' : 'Cuestionar'}
                          </button>
                        </li>
                      ))
                    : <li className="text-slate-500">Sin datos</li>}
                </ul>
              </div>
              <div className="rounded border p-3 bg-white">
                <div className="text-sm font-medium mb-2">Debilidades</div>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {Array.isArray((analysis as any).__derived?.aiWeaknesses) && (analysis as any).__derived.aiWeaknesses.length
                    ? (analysis as any).__derived.aiWeaknesses.map((s: string, i: number) => (
                        <li key={`weak-${i}`} className="flex items-start justify-between gap-2">
                          <span>{s}</span>
                          <button
                            className="text-xs text-blue-600 underline whitespace-nowrap"
                            onClick={() => {
                              setChatInput(`No estoy de acuerdo con la debilidad "${s}": `);
                              document.getElementById('review-chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              setTimeout(() => chatInputRef.current?.focus(), 150);
                              setQuestioned((prev) => ({ ...prev, [`weak:${s}`]: true }));
                            }}
                            disabled={questioned[`weak:${s}`] === true}
                          >
                            {questioned[`weak:${s}`] === true ? 'CUESTIONADO' : 'Cuestionar'}
                          </button>
                        </li>
                      ))
                    : <li className="text-slate-500">Sin datos</li>}
                </ul>
              </div>
              <div className="rounded border p-3 bg-white">
                <div className="text-sm font-medium mb-2">Recomendaciones</div>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {Array.isArray((analysis as any).__derived?.aiRecommendations) && (analysis as any).__derived.aiRecommendations.length
                    ? (analysis as any).__derived.aiRecommendations.map((s: string, i: number) => (
                        <li key={`rec-${i}`} className="flex items-start justify-between gap-2">
                          <span>{s}</span>
                          <button
                            className="text-xs text-blue-600 underline whitespace-nowrap"
                            onClick={() => {
                              setChatInput(`No estoy de acuerdo con la recomendación "${s}": `);
                              document.getElementById('review-chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              setTimeout(() => chatInputRef.current?.focus(), 150);
                              setQuestioned((prev) => ({ ...prev, [`rec:${s}`]: true }));
                            }}
                            disabled={questioned[`rec:${s}`] === true}
                          >
                            {questioned[`rec:${s}`] === true ? 'CUESTIONADO' : 'Cuestionar'}
                          </button>
                        </li>
                      ))
                    : <li className="text-slate-500">Sin datos</li>}
                </ul>
              </div>
            </div>
            {(() => {
              const checklist = ((analysis as any).__derived?.checklistAll || []) as any[];
              const sel = (selectedCatIdx!=null && selectedItemIdx!=null)
                ? (Array.isArray(checklist[selectedCatIdx]?.items) ? checklist[selectedCatIdx].items[selectedItemIdx] : null)
                : null;
              const selCat = (selectedCatIdx!=null) ? checklist[selectedCatIdx]?.category : '';
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-1 border rounded">
                    <div className="max-h-72 overflow-auto">
                      {checklist.map((cat: any, ci: number) => (
                        <div key={`cat-${ci}`} className="border-b last:border-b-0">
                          <div className="px-2 py-1 text-xs font-semibold bg-slate-50">{cat?.category || 'Categoría'}</div>
                          {(Array.isArray(cat?.items) ? cat.items : []).map((it: any, ii: number) => (
                            <button
                              key={`it-${ci}-${ii}`}
                              className={`w-full text-left px-2 py-1 text-sm hover:bg-slate-100 ${selectedCatIdx===ci && selectedItemIdx===ii ? 'bg-slate-100 font-medium' : ''}`}
                              onClick={() => {
                                setSelectedCatIdx(ci); setSelectedItemIdx(ii);
                                const n = it?.name || it?.id || 'ítem';
                                setChatInput(`No estoy de acuerdo con "${n}": `);
                              }}
                            >
                              {(it?.name || it?.id) as string}
                            </button>
                          ))}
                        </div>
                      ))}
                      {checklist.length === 0 && <div className="p-3 text-sm text-slate-500">Sin checklist disponible (ver fortalezas/debilidades/recomendaciones arriba).</div>}
                    </div>
                  </div>
                  <div className="md:col-span-2 border rounded p-3 bg-white">
                    {sel ? (
                      <div className="space-y-2 text-sm">
                        <div className="text-xs text-muted-foreground">Ítem seleccionado</div>
                        <div className="text-base font-semibold">{selCat} • {sel?.name || sel?.id}</div>
                        <div><span className="font-medium">Rating:</span> {typeof sel?.rating === 'number' ? sel.rating : '-'}</div>
                        <div><span className="font-medium">Estado:</span> {sel?.status || '-'}</div>
                        <div>
                          <div className="font-medium">Comentario de la IA</div>
                          <div className="whitespace-pre-wrap">{sel?.comment || '-'}</div>
                        </div>
                        <div className="pt-2 flex items-center gap-4">
                          <button
                            className="text-xs text-blue-600 underline"
                            onClick={() => {
                              const itemName = String(sel?.name || sel?.id || 'ítem');
                              const aiComment = String(sel?.comment || '').slice(0, 200);
                              const base = `No estoy de acuerdo con "${itemName}"`;
                              const msg = aiComment ? `${base}: ${aiComment} ` : `${base}: `;
                              setChatInput(msg);
                              document.getElementById('review-chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              setTimeout(() => chatInputRef.current?.focus(), 150);
                              setQuestioned((prev) => ({ ...prev, [`check:${String(selCat || '')}:${String(sel?.id || '')}`]: true }));
                            }}
                            disabled={questioned[`check:${String(selCat || '')}:${String(sel?.id || '')}`] === true}
                          >
                            {questioned[`check:${String(selCat || '')}:${String(sel?.id || '')}`] === true ? 'CUESTIONADO' : 'Cuestionar este ítem'}
                          </button>
                          <button
                            className="text-xs text-green-700 underline"
                            onClick={async () => {
                              try {
                                setSaving(true);
                                setError(null);
                                const auth = getAuth();
                                const cu = auth.currentUser;
                                if (!cu) throw new Error('Usuario no autenticado');
                                const token = await getIdToken(cu, true);
                                const body = {
                                  category: String(selCat || ''),
                                  itemId: String(sel?.id || ''),
                                  itemName: String(sel?.name || ''),
                                  rating: (typeof sel?.rating === 'number' ? sel.rating : null),
                                  status: (sel?.status || null),
                                  comment: String(sel?.comment || ''),
                                  attachments: [],
                                };
                                const res = await fetch(`/api/analyses/${encodeURIComponent(analysisId)}/training-examples`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
                                const data = await res.json();
                                if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
                                setApprovedExamples((prev) => ({ ...prev, [`item:${String(selCat || '')}:${String(sel?.id || '')}`]: true }));
                              } catch (e:any) {
                                setError(e?.message || 'Error desconocido');
                              } finally {
                                setSaving(false);
                              }
                            }}
                            disabled={saving || approvedExamples[`item:${String(selCat || '')}:${String(sel?.id || '')}`] === true}
                          >
                            {approvedExamples[`item:${String(selCat || '')}:${String(sel?.id || '')}`] === true ? 'APROBADO COMO EJEMPLO' : 'Aprobar como ejemplo'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">Selecciona un ítem para ver el detalle y discutirlo en el chat.</div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Panel de acciones (simplificado) */}
      <div className="rounded border p-4 space-y-4">
        <div className="flex items-center gap-2">
          <input id="chk-listo" type="checkbox" checked={statusListo} onChange={(e)=>setStatusListo(e.target.checked)} />
          <label htmlFor="chk-listo" className="text-sm">Marcar como Listo</label>
        </div>
        <div className="flex gap-2">
          <button className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-60" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-60" onClick={reanalyze} disabled={saving}>
            Reanalizar con feedback
          </button>
          <button className="rounded bg-slate-700 px-3 py-1 text-white" onClick={load} disabled={loading}>Recargar</button>
        </div>
      </div>

      {/* Chat de Revisión */}
      <div id="review-chat" className="rounded border p-4 space-y-3">
        <h2 className="text-lg font-medium">Chat de Revisión</h2>
        {chatLoading ? <p className="text-sm">Cargando conversación…</p> : null}
        {chatError ? <p className="text-sm text-red-600">{chatError}</p> : null}
        <div className="max-h-72 overflow-auto space-y-2 border rounded p-2 bg-white">
          {chatMessages.map((m) => (
            <div key={m.id} className={m.role === 'assistant' ? 'text-sm p-2 rounded bg-slate-50' : 'text-sm p-2 rounded bg-amber-50'}>
              <div>
                <span className="font-semibold mr-2">{m.role === 'assistant' ? 'IA' : 'Tú'}:</span>
                <span>{m.text}</span>
              </div>
              {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {m.attachments.map((url, i) => (
                    <a key={`msgatt-${m.id}-${i}`} href={url} target="_blank" rel="noreferrer" className="w-16 h-16 rounded overflow-hidden border bg-white block">
                      <img src={url} alt="adjunto" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {m.role === 'assistant' && (
                <div className="mt-2">
                  <button
                    className="text-xs text-green-700 underline"
                    onClick={async () => {
                      try {
                        setSaving(true);
                        setError(null);
                        const auth = getAuth();
                        const cu = auth.currentUser;
                        if (!cu) throw new Error('Usuario no autenticado');
                        const token = await getIdToken(cu, true);
                        const body = {
                          category: 'chat_review',
                          itemId: 'assistant_comment',
                          itemName: 'Mensaje IA',
                          rating: null,
                          status: null,
                          comment: String(m.text || ''),
                          attachments: Array.isArray(m.attachments) ? m.attachments : [],
                        };
                        const res = await fetch(`/api/analyses/${encodeURIComponent(analysisId)}/training-examples`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
                        const data = await res.json();
                        if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
                        setApprovedExamples((prev) => ({ ...prev, [`chat:${m.id}`]: true }));
                      } catch (e:any) {
                        setError(e?.message || 'Error desconocido');
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={approvedExamples[`chat:${m.id}`] === true || saving}
                  >
                    {approvedExamples[`chat:${m.id}`] === true ? 'APROBADO COMO EJEMPLO' : 'Aprobar como ejemplo'}
                  </button>
                </div>
              )}
            </div>
          ))}
          {chatMessages.length === 0 && !chatLoading && <p className="text-sm text-muted-foreground">Sin mensajes.</p>}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <input
              ref={chatInputRef}
              className="flex-1 rounded border px-2 py-1"
              placeholder="Escribe tu objeción o pregunta… (puedes pegar capturas)"
              value={chatInput}
              onChange={(e)=>setChatInput(e.target.value)}
              onPaste={async (e) => {
                try {
                  const items = Array.from(e.clipboardData?.items || []);
                  const filesFromItems = items
                    .filter((it) => it.kind === 'file' && it.type && it.type.startsWith('image/'))
                    .map((it) => it.getAsFile())
                    .filter((f): f is File => !!f);
                  const filesFromList = Array.from(e.clipboardData?.files || [])
                    .filter((f) => f && f.type && f.type.startsWith('image/'));
                  const files = [...filesFromItems, ...filesFromList];
                  if (files.length > 0) {
                    e.preventDefault();
                    await uploadFiles(files);
                  }
                } catch (err) {
                  console.error('paste upload error', err);
                  setChatError('Error pegando imagen');
                }
              }}
            />
            <label className="text-xs px-2 py-1 rounded border cursor-pointer bg-white">
              Adjuntar imágenes
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e)=>{
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  await uploadFiles(files);
                }}
              />
            </label>
            <button className="rounded bg-slate-700 px-3 py-1 text-white disabled:opacity-60" disabled={!chatInput.trim()} onClick={async ()=>{
            try {
              setChatLoading(true);
              setChatError(null);
              const auth = getAuth();
              const cu = auth.currentUser;
              if (!cu) throw new Error('Usuario no autenticado');
              const token = await getIdToken(cu, true);
              const res = await fetch(`/api/analyses/${encodeURIComponent(analysisId)}/chat`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ message: chatInput, attachments }) });
              const data = await res.json();
              if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
              setChatInput('');
              setAttachments([]);
              await loadChat();
            } catch (e:any) {
              setChatError(e?.message || 'Error desconocido');
            } finally { setChatLoading(false); }
          }}>Enviar</button>
          </div>
          {recentThumbs.length > 0 && (
            <div className="flex items-center gap-2 pl-1">
              <span className="text-xs text-green-700">Imagen agregada</span>
              <div className="flex gap-1">
                {recentThumbs.slice(0, 3).map((url, i) => (
                  <div key={`recent-${i}`} className="w-10 h-10 rounded overflow-hidden border">
                    <img src={url} alt="preview" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {attachments.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {attachments.map((url, i) => (
                <div key={`att-${i}`} className="w-20 h-20 rounded overflow-hidden border bg-white relative">
                  <img src={url} alt="adjunto" className="w-full h-full object-cover" />
                </div>
              ))}
              {uploading && <span className="text-xs text-muted-foreground">Subiendo…</span>}
            </div>
          )}
          {uploadNotice && (
            <div className="text-xs text-green-700">{uploadNotice}</div>
          )}
        </div>
      </div>
    </div>
  );
}


