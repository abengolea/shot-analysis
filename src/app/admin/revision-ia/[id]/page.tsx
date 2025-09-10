"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getAuth, getIdToken } from "firebase/auth";

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
  const [startFrame, setStartFrame] = useState<string>("");
  const [endFrame, setEndFrame] = useState<string>("");
  const [commentForAI, setCommentForAI] = useState<string>("");
  const [statusListo, setStatusListo] = useState<boolean>(false);

  const issueMap = useMemo(() => Object.fromEntries(ISSUE_OPTIONS.map(o => [o.id, o.label])), []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      // analysis
      const resA = await fetch(`/api/analyses/${encodeURIComponent(analysisId)}`);
      const dataA = await resA.json();
      if (!resA.ok) throw new Error(dataA?.error || `HTTP ${resA.status}`);
      const a = dataA?.analysis || null;
      if (a) {
        setAnalysis({ id: a.id, playerId: a.playerId, createdAt: a.createdAt, shotType: a.shotType, score: a.score });
        setPlayerId(String(a.playerId || ''));
      }
      // existing feedback
      const resF = await fetch(`/api/analyses/${encodeURIComponent(analysisId)}/admin-feedback`);
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Revisión IA — Detalle</h1>
        <Link className="text-blue-600 underline" href="/admin/revision-ia">Volver</Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {analysis && (
        <div className="rounded border p-4 space-y-2 text-sm">
          <div><span className="font-semibold">Análisis:</span> {analysis.id}</div>
          <div><span className="font-semibold">Jugador:</span> {analysis.playerId}</div>
          <div><span className="font-semibold">Fecha:</span> {new Date(analysis.createdAt).toLocaleString()}</div>
          <div><span className="font-semibold">Tipo:</span> {analysis.shotType || '-'}</div>
          <div><span className="font-semibold">Score:</span> {typeof analysis.score === 'number' ? analysis.score : '-'}</div>
        </div>
      )}

      <div className="rounded border p-4 space-y-4">
        <div className="flex items-center gap-2">
          <label className="text-sm">Jugador (ID)</label>
          <input className="rounded border px-2 py-1" value={playerId} onChange={(e)=>setPlayerId(e.target.value)} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-sm">Agregar ítem</label>
            <select className="rounded border px-2 py-1" value={selectedIssueId} onChange={(e)=>setSelectedIssueId(e.target.value as IssueId)}>
              {ISSUE_OPTIONS.map((o)=> (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <button className="rounded bg-slate-700 px-2 py-1 text-white" onClick={addIssue}>Agregar</button>
          </div>

          <div className="space-y-3">
            {issues.map((it)=> (
              <div key={it.id} className="rounded border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{issueMap[it.id] || it.id}</div>
                  <button className="text-sm text-red-600" onClick={()=>removeIssue(it.id)}>Quitar</button>
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Severidad</label>
                    <select className="rounded border px-2 py-1" value={it.severity || ''} onChange={(e)=>updateIssue(it.id, { severity: (e.target.value || undefined) as Severity })}>
                      <option value="">-</option>
                      <option value="bajo">Bajo</option>
                      <option value="medio">Medio</option>
                      <option value="alto">Alto</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Rating</label>
                    <select className="rounded border px-2 py-1" value={it.rating || ''} onChange={(e)=>updateIssue(it.id, { rating: (e.target.value ? Number(e.target.value) : undefined) as any })}>
                      <option value="">-</option>
                      {[1,2,3,4,5].map(n=> <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-2">
                  <label className="text-sm">Comentario para IA</label>
                  <textarea className="mt-1 w-full rounded border px-2 py-1" rows={2} value={it.commentForAI || ''} onChange={(e)=>updateIssue(it.id, { commentForAI: e.target.value })} />
                </div>
              </div>
            ))}
            {issues.length === 0 && <p className="text-sm text-slate-500">Sin ítems agregados.</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm">Inicio (frame)</label>
            <input className="rounded border px-2 py-1 w-28" inputMode="numeric" value={startFrame} onChange={(e)=>setStartFrame(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Fin (frame)</label>
            <input className="rounded border px-2 py-1 w-28" inputMode="numeric" value={endFrame} onChange={(e)=>setEndFrame(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-sm">Comentario general para IA</label>
          <textarea className="mt-1 w-full rounded border px-2 py-1" rows={3} value={commentForAI} onChange={(e)=>setCommentForAI(e.target.value)} />
        </div>

        <div className="flex items-center gap-2">
          <input id="chk-listo" type="checkbox" checked={statusListo} onChange={(e)=>setStatusListo(e.target.checked)} />
          <label htmlFor="chk-listo" className="text-sm">Marcar como Listo</label>
        </div>

        <div className="flex gap-2">
          <button className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-60" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button className="rounded bg-slate-700 px-3 py-1 text-white" onClick={load} disabled={loading}>Recargar</button>
        </div>
      </div>
    </div>
  );
}


