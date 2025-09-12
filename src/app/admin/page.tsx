	"use client";
	import Link from "next/link";	
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getAuth, getIdToken } from "firebase/auth";

type Diagnostics = {
  adminInitialized: boolean;
  env: Record<string, any>;
  storageInfo: { ok: boolean; bucket?: string; expected?: string; error?: string };
  firestoreProbe: { ok: boolean; count?: number; needsIndex?: boolean; indexHint?: string; error?: string };
};

export default function AdminHome() {
	const { user } = useAuth();
	const [running, setRunning] = useState(false);
	const [result, setResult] = useState<Diagnostics | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [userCountLoading, setUserCountLoading] = useState(false);
	const [userAnalysesCount, setUserAnalysesCount] = useState<number | null>(null);
	const [recalcLoading, setRecalcLoading] = useState(false);
	const [recalcUpdated, setRecalcUpdated] = useState<number | null>(null);
	const [recalcError, setRecalcError] = useState<string | null>(null);
	const [shotType, setShotType] = useState<string>(""); // vacío = todos
	const [rebuildId, setRebuildId] = useState("");
	const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);

	const runDiagnostics = async () => {
		try {
			setRunning(true);
			setError(null);
			setResult(null);
			const auth = getAuth();
			const cu = auth.currentUser;
			if (!cu) throw new Error('Usuario no autenticado');
			const token = await getIdToken(cu, true);
			const res = await fetch('/api/admin/diagnostics', { headers: { 'Authorization': `Bearer ${token}` } });
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}
			const data = await res.json();
			setResult(data as Diagnostics);
		} catch (e: any) {
			setError(e?.message || 'Error desconocido');
		} finally {
			setRunning(false);
		}
	};

	const countForCurrentUser = async () => {
		try {
			setUserCountLoading(true);
			setUserAnalysesCount(null);
			const uid = user?.uid;
			if (!uid) throw new Error('Usuario no autenticado');
			const res = await fetch(`/api/analyses?userId=${encodeURIComponent(uid)}`);
			if (!res.ok) throw new Error('Error consultando analyses del usuario');
			const data = await res.json();
			setUserAnalysesCount(Number(data?.count || 0));
		} catch (e: any) {
			setError(e?.message || 'Error desconocido');
		} finally {
			setUserCountLoading(false);
		}
	};

	const runRecalculateScores = async () => {
		try {
			setRecalcLoading(true);
			setRecalcUpdated(null);
			setRecalcError(null);
			if (!confirm("¿Recalcular puntajes históricos con la nueva lógica? Esta acción puede tardar.")) {
				return;
			}
			const auth = getAuth();
			const cu = auth.currentUser;
			if (!cu) throw new Error("Usuario no autenticado");
			const token = await getIdToken(cu, true);
			const url = `/api/admin/recalculate-scores?shotType=${encodeURIComponent(shotType)}`;
			const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
			const data = await res.json();
			if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
			setRecalcUpdated(Number(data.updated || 0));
		} catch (e: any) {
			setRecalcError(e?.message || 'Error desconocido');
		} finally {
			setRecalcLoading(false);
		}
	};

	const runRebuildDev = async () => {
		try {
			setRebuildMsg(null);
			const res = await fetch(`/api/analyses/${encodeURIComponent(rebuildId)}/rebuild-keyframes/dev`, { method: 'POST' });
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
			setRebuildMsg(`OK: ${(data?.keyframes && Object.values(data.keyframes).reduce((a:number,arr:any)=>a+(Array.isArray(arr)?arr.length:0),0)) || 0} fotogramas`);
		} catch (e: any) {
			setRebuildMsg(e?.message || 'Error desconocido');
		}
	};

	return (
		<div className="p-6 space-y-6">
			<h1 className="text-xl font-semibold">Admin</h1>
			<ul className="list-disc pl-6 space-y-2">
				<li>
					<Link className="text-blue-600 underline" href="/admin/labeling">Herramienta de etiquetado</Link>
				</li>
				<li>
					<Link className="text-blue-600 underline" href="/admin/revision-ia">Revisión IA (ver lanzamientos)</Link>
				</li>
				<li>
					<Link className="text-blue-600 underline" href="/admin/upload-analyze">Subir JSON y analizar</Link>
				</li>
				<li>
					<Link className="text-blue-600 underline" href="/admin/scoring">Ponderaciones de Puntuación</Link>
				</li>
				<li>
					<Link className="text-blue-600 underline" href="/admin/prompts">Ajustes de Prompts (IA)</Link>
				</li>
				<li>
					<Link className="text-blue-600 underline" href="/admin/help">Ayuda</Link>
				</li>
				<li>
					<Link className="text-blue-600 underline" href="/rankings">Ver Rankings Públicos</Link>
				</li>
			</ul>

			<div className="mt-6 rounded border p-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-medium">Diagnóstico de Producción</h2>
					<button
						className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-60"
						onClick={runDiagnostics}
						disabled={running}
					>
						{running ? 'Verificando…' : 'Verificar producción'}
					</button>
				</div>

				<div className="mt-3 flex items-center gap-2">
					<button
						className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-60"
						onClick={countForCurrentUser}
						disabled={userCountLoading}
					>
						{userCountLoading ? 'Contando…' : 'Contar análisis del usuario actual'}
					</button>
					{userAnalysesCount != null && (
						<span className="text-sm">Total: {userAnalysesCount}</span>
					)}
				</div>

				{error && (
					<p className="mt-3 text-sm text-red-600">{error}</p>
				)}

				{result && (
					<div className="mt-4 space-y-3 text-sm">
						<div>
							<span className="font-semibold">Admin SDK:</span>{' '}
							{result.adminInitialized ? 'OK' : 'NO inicializado'}
						</div>
						<div>
							<span className="font-semibold">Env:</span>{' '}
							CLIENT_EMAIL {result.env.FIREBASE_ADMIN_CLIENT_EMAIL ? '✓' : '✗'} · PRIVATE_KEY {result.env.FIREBASE_ADMIN_PRIVATE_KEY ? '✓' : '✗'} · PROJECT_ID {result.env.FIREBASE_ADMIN_PROJECT_ID ? '✓' : '✗'}
						</div>
						<div>
							<span className="font-semibold">Storage bucket:</span>{' '}
							{result.storageInfo.ok ? (
								<span>
									{result.storageInfo.bucket}
									{result.storageInfo.expected && result.storageInfo.expected !== result.storageInfo.bucket && (
										<span className="text-amber-700"> (esperado {result.storageInfo.expected})</span>
									)}
								</span>
							) : (
								<span className="text-red-700">{result.storageInfo.error || 'No disponible'}</span>
							)}
						</div>
						<div>
							<span className="font-semibold">Consulta analyses (playerId + createdAt):</span>{' '}
							{result.firestoreProbe.ok ? (
								<span>OK (size: {result.firestoreProbe.count})</span>
							) : (
								<span className="text-red-700">
									{result.firestoreProbe.needsIndex ? (result.firestoreProbe.indexHint || 'Falta índice') : (result.firestoreProbe.error || 'Error')}
								</span>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Recalcular puntajes históricos */}
			<div className="mt-6 rounded border p-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-medium">Recalcular Puntajes Históricos</h2>
				</div>
				<div className="mt-3 flex items-center gap-2">
					<label className="text-sm">Tipo de tiro:</label>
					<select
						className="rounded border px-2 py-1"
						value={shotType}
						onChange={(e) => setShotType(e.target.value)}
					>
						<option value="">Todos</option>
						<option value="libre">Libre</option>
						<option value="media">Media distancia / Jump</option>
						<option value="tres">Tres puntos</option>
					</select>
					<button
						className="rounded bg-purple-600 px-3 py-1 text-white disabled:opacity-60"
						onClick={runRecalculateScores}
						disabled={recalcLoading}
					>
						{recalcLoading ? 'Recalculando…' : 'Recalcular ahora'}
					</button>
				</div>
				{recalcError && (
					<p className="mt-3 text-sm text-red-600">{recalcError}</p>
				)}
				{recalcUpdated != null && (
					<p className="mt-3 text-sm">Actualizados: {recalcUpdated}</p>
				)}
			</div>

			{/* Rebuild Keyframes (Dev) */}
			<div className="mt-6 rounded border p-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-medium">Reconstruir Fotogramas (Dev)</h2>
				</div>
				<div className="mt-3 flex items-center gap-2">
					<input className="rounded border px-2 py-1 w-96" placeholder="ID de análisis" value={rebuildId} onChange={(e)=>setRebuildId(e.target.value)} />
					<button className="rounded bg-slate-700 px-3 py-1 text-white disabled:opacity-60" onClick={runRebuildDev} disabled={!rebuildId}>
						Reconstruir
					</button>
					{rebuildMsg && <span className="text-sm">{rebuildMsg}</span>}
				</div>
			</div>
		</div>
	);
}
