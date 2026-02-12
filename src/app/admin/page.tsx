"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuth, getIdToken } from "firebase/auth";
import { ClubAdminForm } from "@/components/club-admin-form";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

function PlayerGiftDropdown({ onGift }: { onGift: (count: number) => Promise<void> }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="h-7 text-xs">Regalar</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{[1, 3, 5, 10].map((n) => (
					<DropdownMenuItem key={n} onSelect={() => void onGift(n)}>
						+{n} análisis y +{n} revisiones
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

type WeeklyPoint = {
	weekStart: string;
	paymentsCount: number;
	paymentsAmountARS: number;
	analysesCount: number;
};

type OverviewMetrics = {
	totalPlayers: number;
	totalCoaches: number;
	payingUsers: number;
	approvedPaymentsCount: number;
	revenueARS: number;
	activeSubscriptions: number;
	analysesCount: number;
	weekly: WeeklyPoint[];
};

export default function AdminHome() {
	const [activeTab, setActiveTab] = useState<string>("home");
	const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	// Listados: jugadores, entrenadores, pagos, suscripciones
	const [players, setPlayers] = useState<any[]>([]);
	const [playersNext, setPlayersNext] = useState<string | undefined>(undefined);
	const [playersLoading, setPlayersLoading] = useState(false);

	const [coaches, setCoaches] = useState<any[]>([]);
	const [coachesNext, setCoachesNext] = useState<string | undefined>(undefined);
	const [coachesLoading, setCoachesLoading] = useState(false);
	const [coachUpdatingId, setCoachUpdatingId] = useState<string | null>(null);

	const [clubRequests, setClubRequests] = useState<any[]>([]);
	const [clubRequestsLoading, setClubRequestsLoading] = useState(false);
	const [clubsList, setClubsList] = useState<any[]>([]);
	const [clubsListLoading, setClubsListLoading] = useState(false);

	// Acceso por club + coach (La Emilia, Victor Baldo, etc.)
	const [clubBulkName, setClubBulkName] = useState<string>("");
	const [clubBulkCoachId, setClubBulkCoachId] = useState<string>("");
	const [clubBulkGiftAnalyses, setClubBulkGiftAnalyses] = useState<number>(5);
	const [clubBulkGiftReviews, setClubBulkGiftReviews] = useState<number>(5);
	const [clubBulkPreview, setClubBulkPreview] = useState<{ count: number; players: Array<{ id: string; name: string; email: string; club: string; yaRecibioRegalo?: boolean }>; nuevos?: number } | null>(null);
	const [clubBulkLoading, setClubBulkLoading] = useState(false);
	const [clubBulkExecuting, setClubBulkExecuting] = useState(false);
	const [clubBulkResult, setClubBulkResult] = useState<string | null>(null);

	const [payments, setPayments] = useState<any[]>([]);
	const [paymentsNext, setPaymentsNext] = useState<string | undefined>(undefined);
	const [paymentsLoading, setPaymentsLoading] = useState(false);
	const [paymentsStatus, setPaymentsStatus] = useState<string>("");

	const [subs, setSubs] = useState<any[]>([]);
	const [subsNext, setSubsNext] = useState<string | undefined>(undefined);
	const [subsLoading, setSubsLoading] = useState(false);

	// Filtros de búsqueda
	const [playersQuery, setPlayersQuery] = useState<string>("");
	const [playersClubFilter, setPlayersClubFilter] = useState<string>("");
	const [coachesQuery, setCoachesQuery] = useState<string>("");
	const [paymentsQuery, setPaymentsQuery] = useState<string>("");
	const [subsQuery, setSubsQuery] = useState<string>("");

	// Helpers CSV export
	const toCsvAndDownload = (filename: string, headers: string[], rows: Array<(string|number|null|undefined)[]>) => {
		try {
			const escape = (v: any) => {
				if (v == null) return '';
				const s = String(v);
				if (s.includes('"') || s.includes(',') || s.includes('\n')) {
					return '"' + s.replace(/"/g, '""') + '"';
				}
				return s;
			};
			const lines = [headers.join(',')].concat(rows.map(r => r.map(escape).join(',')));
			const blob = new Blob(["\ufeff" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		} catch {}
	};

	// Datos filtrados (cliente) - barato
	const filteredPlayers = useMemo(() => {
		const q = playersQuery.trim().toLowerCase();
		if (!q) return players;
		return players.filter(p => String(p.id).toLowerCase().includes(q)
			|| String(p.email||'').toLowerCase().includes(q)
			|| String(p.name||'').toLowerCase().includes(q));
	}, [players, playersQuery]);
	const filteredCoaches = useMemo(() => {
		const q = coachesQuery.trim().toLowerCase();
		if (!q) return coaches;
		return coaches.filter(c => String(c.id).toLowerCase().includes(q)
			|| String(c.email||'').toLowerCase().includes(q)
			|| String(c.name||'').toLowerCase().includes(q));
	}, [coaches, coachesQuery]);
	const filteredPayments = useMemo(() => {
		const q = paymentsQuery.trim().toLowerCase();
		if (!q) return payments;
		return payments.filter(p => String(p.id).toLowerCase().includes(q)
			|| String(p.userId||'').toLowerCase().includes(q)
			|| String(p.productId||'').toLowerCase().includes(q));
	}, [payments, paymentsQuery]);
	const filteredSubs = useMemo(() => {
		const q = subsQuery.trim().toLowerCase();
		if (!q) return subs;
		return subs.filter(w => String(w.id).toLowerCase().includes(q)
			|| String(w.userId||'').toLowerCase().includes(q));
	}, [subs, subsQuery]);

	useEffect(() => {
		try {
			const sp = new URLSearchParams(window.location.search);
			const t = sp.get("tab");
			if (t) setActiveTab(t);
		} catch {}
	}, []);

	useEffect(() => {
		const run = async () => {
			try {
				setLoading(true);
				setError(null);
				const auth = getAuth();
				const cu = auth.currentUser;
				if (!cu) throw new Error("Usuario no autenticado");
				const token = await getIdToken(cu, true);
				const res = await fetch('/api/admin/metrics/overview', { headers: { 'Authorization': `Bearer ${token}` } });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = await res.json();
				setMetrics(data as OverviewMetrics);
			} catch (e: any) {
				setError(e?.message || 'Error cargando métricas');
			} finally {
				setLoading(false);
			}
		};
		run();
	}, []);

	// Cargar coaches y clubes al abrir tab de clubes o jugadores
	useEffect(() => {
		if (activeTab !== 'clubs' && activeTab !== 'players') return;
		const loadCoaches = async () => {
			if (coaches.length > 0 || coachesLoading) return;
			try {
				setCoachesLoading(true);
				const auth = getAuth();
				const cu = auth.currentUser;
				if (!cu) return;
				const token = await getIdToken(cu, true);
				const res = await fetch('/api/admin/coaches?limit=200', { headers: { Authorization: `Bearer ${token}` } });
				const data = await res.json();
				if (Array.isArray(data.items)) setCoaches(data.items);
			} catch {
				// noop
			} finally {
				setCoachesLoading(false);
			}
		};
		const loadClubs = async () => {
			if (clubsListLoading) return;
			try {
				setClubsListLoading(true);
				const auth = getAuth();
				const cu = auth.currentUser;
				if (!cu) return;
				const token = await getIdToken(cu, true);
				const res = await fetch('/api/admin/clubs?limit=100', { headers: { Authorization: `Bearer ${token}` } });
				const data = await res.json();
				if (Array.isArray(data.items)) setClubsList(data.items);
			} catch {
				// noop
			} finally {
				setClubsListLoading(false);
			}
		};
		loadCoaches();
		loadClubs();
	}, [activeTab]);

	const Tabs = useMemo(() => [
		{ id: 'home', label: 'Inicio' },
		{ id: 'players', label: 'Jugadores' },
		{ id: 'coaches', label: 'Entrenadores' },
		{ id: 'clubs', label: 'Clubes' },
		{ id: 'payments', label: 'Pagos' },
		{ id: 'subscriptions', label: 'Suscripciones' },
		{ id: 'stats', label: 'Estadísticas' },
	], []);

	const setTab = (id: string) => {
		setActiveTab(id);
		try {
			const url = new URL(window.location.href);
			url.searchParams.set('tab', id);
			window.history.replaceState({}, '', url.toString());
		} catch {}
	};

	const refreshClubsList = useCallback(async () => {
		try {
			const auth = getAuth();
			const cu = auth.currentUser;
			if (!cu) return;
			const token = await getIdToken(cu, true);
			const res = await fetch('/api/admin/clubs?limit=100', { headers: { Authorization: `Bearer ${token}` } });
			const data = await res.json();
			if (Array.isArray(data.items)) setClubsList(data.items);
		} catch {
			// noop
		}
	}, []);

	const updateCoach = async (
		id: string,
		payload: { status?: 'active' | 'pending' | 'suspended'; ratePerAnalysis?: number }
	) => {
		try {
			setCoachUpdatingId(id);
			const auth = getAuth();
			const cu = auth.currentUser;
			if (!cu) throw new Error('Usuario no autenticado');
			const token = await getIdToken(cu, true);
			const res = await fetch('/api/admin/coaches', {
				method: 'PATCH',
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ id, ...payload }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
			setCoaches((prev) => prev.map((c) => (c.id === id ? { ...c, ...payload } : c)));
		} catch (e: any) {
			alert(e?.message || 'Error actualizando entrenador');
		} finally {
			setCoachUpdatingId(null);
		}
	};

	return (
		<div className="p-4 sm:p-6 space-y-6 min-w-0">
			<h1 className="text-xl font-semibold">Admin</h1>

			{/* Tabs */}
			<div className="flex gap-2 border-b overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
				{Tabs.map(t => (
					<button
						key={t.id}
						className={`px-3 py-2 -mb-px border-b-2 ${activeTab === t.id ? 'border-black font-semibold' : 'border-transparent text-gray-500'}`}
						onClick={() => setTab(t.id)}
					>
						{t.label}
					</button>
				))}
			</div>

			{/* Contenido: Inicio */}
			{activeTab === 'home' && (
				<div className="space-y-6">
					{error && <p className="text-sm text-red-600">{error}</p>}
					{loading && <p className="text-sm">Cargando…</p>}
					{metrics && (
						<>
							{/* KPIs */}
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
								<div className="rounded border p-4"><div className="text-xs text-gray-500">Jugadores</div><div className="text-2xl font-semibold">{metrics.totalPlayers}</div></div>
								<div className="rounded border p-4"><div className="text-xs text-gray-500">Entrenadores</div><div className="text-2xl font-semibold">{metrics.totalCoaches}</div></div>
								<div className="rounded border p-4"><div className="text-xs text-gray-500">Usuarios con pago</div><div className="text-2xl font-semibold">{metrics.payingUsers}</div></div>
								<div className="rounded border p-4"><div className="text-xs text-gray-500">Pagos aprobados</div><div className="text-2xl font-semibold">{metrics.approvedPaymentsCount}</div></div>
								<div className="rounded border p-4"><div className="text-xs text-gray-500">Ingresos (ARS)</div><div className="text-2xl font-semibold">{metrics.revenueARS.toLocaleString('es-AR')}</div></div>
								<div className="rounded border p-4"><div className="text-xs text-gray-500">Suscripciones activas</div><div className="text-2xl font-semibold">{metrics.activeSubscriptions}</div></div>
								<div className="rounded border p-4"><div className="text-xs text-gray-500">Análisis totales</div><div className="text-2xl font-semibold">{metrics.analysesCount}</div></div>
							</div>

							{/* Acciones de mantenimiento */}
							<div className="mt-4 rounded border p-4 space-y-3">
								<h2 className="text-lg font-medium">Mantenimiento</h2>
								<p className="text-sm text-gray-600">Recalcular puntajes históricos a escala 0–100.</p>
								<div className="flex flex-wrap gap-2">
									<Link className="rounded border px-3 py-1 text-sm hover:bg-gray-50" href="/admin/maintenance">
										Abrir panel de mantenimiento
									</Link>
								</div>
								<div className="flex flex-wrap gap-2">
									<button
										className="rounded border px-3 py-1 text-sm"
										onClick={async () => {
											try {
												const auth = getAuth();
												const cu = auth.currentUser;
												if (!cu) throw new Error('Usuario no autenticado');
												const token = await getIdToken(cu, true);
												const res = await fetch('/api/admin/recalculate-scores', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
												const data = await res.json();
												alert(res.ok ? `Recalculados: ${data.updated}` : `Error: ${data.error || res.status}`);
											} catch (e: any) {
												alert(e?.message || 'Error ejecutando recálculo');
											}
										}}
									>
										Recalcular puntajes (todos)
									</button>
									<button
										className="rounded border px-3 py-1 text-sm"
										onClick={async () => {
											try {
												const auth = getAuth();
												const cu = auth.currentUser;
												if (!cu) throw new Error('Usuario no autenticado');
												const token = await getIdToken(cu, true);
												const shotType = prompt('Filtrar por tipo (tres/media/libre). Dejar vacío para todos:') || '';
												const url = new URL('/api/admin/recalculate-scores', window.location.origin);
												if (shotType) url.searchParams.set('shotType', shotType);
												const res = await fetch(url.toString(), { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
												const data = await res.json();
												alert(res.ok ? `Recalculados: ${data.updated}` : `Error: ${data.error || res.status}`);
											} catch (e: any) {
												alert(e?.message || 'Error ejecutando recálculo');
											}
										}}
									>
										Recalcular por tipo
									</button>
								</div>
							</div>

							{/* Series semanales */}
							<div className="mt-4 rounded border p-4">
								<h2 className="text-lg font-medium">Últimas 8 semanas</h2>
								<div className="overflow-x-auto mt-2">
									<table className="min-w-[600px] text-sm">
										<thead>
											<tr className="text-left">
												<th className="py-1 pr-4">Semana</th>
												<th className="py-1 pr-4">Pagos</th>
												<th className="py-1 pr-4">ARS</th>
												<th className="py-1 pr-4">Análisis</th>
											</tr>
										</thead>
										<tbody>
											{metrics.weekly.map((w) => (
												<tr key={w.weekStart} className="border-t">
													<td className="py-1 pr-4">{w.weekStart}</td>
													<td className="py-1 pr-4">{w.paymentsCount}</td>
													<td className="py-1 pr-4">{w.paymentsAmountARS.toLocaleString('es-AR')}</td>
													<td className="py-1 pr-4">{w.analysesCount}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>

							{/* Mapa de la aplicación */}
							<div className="mt-4">
								<h2 className="text-lg font-medium">Mapa de la aplicación</h2>
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
									<Link className="rounded border p-3 hover:bg-gray-50" href="/admin?tab=players">Jugadores</Link>
									<Link className="rounded border p-3 hover:bg-gray-50" href="/admin?tab=coaches">Entrenadores</Link>
									<Link className="rounded border p-3 hover:bg-gray-50" href="/admin?tab=payments">Pagos</Link>
									<Link className="rounded border p-3 hover:bg-gray-50" href="/admin?tab=subscriptions">Suscripciones</Link>
									<Link className="rounded border p-3 hover:bg-gray-50" href="/admin/maintenance">Mantenimiento</Link>
									<Link className="rounded border p-3 hover:bg-gray-50" href="/admin/revision-ia">Revisión IA</Link>
									<Link className="rounded border p-3 hover:bg-gray-50" href="/rankings">Rankings públicos</Link>
									<Link className="rounded border p-3 hover:bg-gray-50" href="/upload">Subir y analizar video</Link>
									<Link className="rounded border p-3 hover:bg-gray-50" href="/dashboard">Dashboard usuario</Link>
								</div>
							</div>
						</>
					)}
				</div>
			)}

			{/* Suscripciones */}
			{activeTab === 'subscriptions' && (
				<div className="space-y-3">
					<div className="flex items-center justify-between gap-2 flex-wrap">
						<h2 className="text-lg font-medium">Suscripciones (History+)</h2>
						<div className="flex items-center gap-2">
							<input className="rounded border px-2 py-1 text-sm" placeholder="Buscar ID/Usuario" value={subsQuery} onChange={(e)=>setSubsQuery(e.target.value)} />
							<button className="rounded border px-3 py-1 text-sm" onClick={() => {
                                const headers = ['userId','active','validUntil','credits','updatedAt'];
                                const rows = filteredSubs.map((w:any) => [w.userId||w.id, w.historyPlusActive?'SI':'NO', typeof w.historyPlusValidUntil === 'string' ? w.historyPlusValidUntil : (w?.historyPlusValidUntil?.toDate?.() ? w.historyPlusValidUntil.toDate().toISOString() : (typeof w?.historyPlusValidUntil?._seconds === 'number' ? new Date(w.historyPlusValidUntil._seconds * 1000 + Math.round((w.historyPlusValidUntil._nanoseconds||0)/1e6)).toISOString() : '')), w.credits, typeof w.updatedAt === 'string' ? w.updatedAt : (w?.updatedAt?.toDate?.() ? w.updatedAt.toDate().toISOString() : (typeof w?.updatedAt?._seconds === 'number' ? new Date(w.updatedAt._seconds * 1000 + Math.round((w.updatedAt._nanoseconds||0)/1e6)).toISOString() : ''))]);
								toCsvAndDownload('subscriptions.csv', headers, rows);
							}}>Exportar CSV</button>
						</div>
						<button
							className="rounded border px-3 py-1 text-sm"
							onClick={async () => {
								try {
									setSubsLoading(true);
									const auth = getAuth();
									const cu = auth.currentUser;
									if (!cu) throw new Error('Usuario no autenticado');
									const token = await getIdToken(cu, true);
									const url = new URL('/api/admin/subscriptions', window.location.origin);
									url.searchParams.set('limit', '100');
									const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
									const data = await res.json();
									setSubs(Array.isArray(data.items) ? data.items : []);
									setSubsNext(data.nextCursor);
								} catch {
									// noop
								} finally {
									setSubsLoading(false);
								}
							}}
						>
							{subs.length ? 'Refrescar' : 'Cargar'}
						</button>
					</div>
					<div className="rounded border overflow-x-auto">
						<table className="min-w-[900px] text-sm">
							<thead>
								<tr className="text-left">
									<th className="py-2 px-3">Usuario</th>
									<th className="py-2 px-3">Activa</th>
									<th className="py-2 px-3">Vence</th>
									<th className="py-2 px-3">Créditos</th>
									<th className="py-2 px-3">Actualizado</th>
								</tr>
							</thead>
							<tbody>
								{filteredSubs.map((w) => (
									<tr key={w.id} className="border-t">
                                        <td className="py-2 px-3">{w.userId || w.id}</td>
                                        <td className="py-2 px-3">{w.historyPlusActive ? 'Sí' : 'No'}</td>
                                        <td className="py-2 px-3">{typeof w.historyPlusValidUntil === 'string' ? w.historyPlusValidUntil : (w?.historyPlusValidUntil?.toDate?.() ? w.historyPlusValidUntil.toDate().toISOString() : (typeof w?.historyPlusValidUntil?._seconds === 'number' ? new Date(w.historyPlusValidUntil._seconds * 1000 + Math.round((w.historyPlusValidUntil._nanoseconds||0)/1e6)).toISOString() : '-'))}</td>
                                        <td className="py-2 px-3">{typeof w.credits === 'number' ? w.credits : '-'}</td>
                                        <td className="py-2 px-3">{typeof w.updatedAt === 'string' ? w.updatedAt : (w?.updatedAt?.toDate?.() ? w.updatedAt.toDate().toISOString() : (typeof w?.updatedAt?._seconds === 'number' ? new Date(w.updatedAt._seconds * 1000 + Math.round((w.updatedAt._nanoseconds||0)/1e6)).toISOString() : '-'))}</td>
									</tr>
								))}
								{!filteredSubs.length && (
									<tr>
										<td className="py-6 px-3 text-gray-500" colSpan={5}>{subsLoading ? 'Cargando…' : 'Sin datos'}</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
					<div className="flex justify-end">
						<button
							className="rounded border px-3 py-1 text-sm disabled:opacity-50"
							disabled={!subsNext || subsLoading}
							onClick={async () => {
								try {
									setSubsLoading(true);
									const auth = getAuth();
									const cu = auth.currentUser;
									if (!cu) throw new Error('Usuario no autenticado');
									const token = await getIdToken(cu, true);
									const url = new URL('/api/admin/subscriptions', window.location.origin);
									url.searchParams.set('limit', '100');
									if (subsNext) url.searchParams.set('startAfter', subsNext);
									const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
									const data = await res.json();
									setSubs([...subs, ...(Array.isArray(data.items) ? data.items : [])]);
									setSubsNext(data.nextCursor);
								} catch {
									// noop
								} finally {
									setSubsLoading(false);
								}
						}}
						>
							Cargar más
						</button>
					</div>
				</div>
			)}

			{/* Pagos */}
			{activeTab === 'payments' && (
				<div className="space-y-3">
					<div className="flex items-center justify-between gap-2 flex-wrap">
						<h2 className="text-lg font-medium">Pagos</h2>
						<div className="flex items-center gap-2">
							<label className="text-sm">Estado</label>
							<select
								className="rounded border px-2 py-1 text-sm"
								value={paymentsStatus}
								onChange={(e) => setPaymentsStatus(e.target.value)}
							>
								<option value="">Todos</option>
								<option value="approved">Aprobados</option>
								<option value="pending">Pendientes</option>
								<option value="rejected">Rechazados</option>
							</select>
							<input className="rounded border px-2 py-1 text-sm" placeholder="Buscar ID/Usuario/Producto" value={paymentsQuery} onChange={(e)=>setPaymentsQuery(e.target.value)} />
							<button className="rounded border px-3 py-1 text-sm" onClick={() => {
                                const headers = ['id','userId','productId','status','amount','currency','createdAt'];
                                const rows = filteredPayments.map((p:any) => [p.id,p.userId,p.productId,p.status,p.amount,p.currency, typeof p.createdAt === 'string' ? p.createdAt : (p?.createdAt?.toDate?.() ? p.createdAt.toDate().toISOString() : (typeof p?.createdAt?._seconds === 'number' ? new Date(p.createdAt._seconds * 1000 + Math.round((p.createdAt._nanoseconds||0)/1e6)).toISOString() : ''))]);
								toCsvAndDownload('payments.csv', headers, rows);
							}}>Exportar CSV</button>
							<button
								className="rounded border px-3 py-1 text-sm"
								onClick={async () => {
									try {
										setPaymentsLoading(true);
										const auth = getAuth();
										const cu = auth.currentUser;
										if (!cu) throw new Error('Usuario no autenticado');
										const token = await getIdToken(cu, true);
										const url = new URL('/api/admin/payments', window.location.origin);
										url.searchParams.set('limit', '50');
										if (paymentsStatus) url.searchParams.set('status', paymentsStatus);
										const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
										const data = await res.json();
										setPayments(Array.isArray(data.items) ? data.items : []);
										setPaymentsNext(data.nextCursor);
									} catch {
										// noop
									} finally {
										setPaymentsLoading(false);
									}
							}}
							>
								{payments.length ? 'Refrescar' : 'Cargar'}
							</button>
						</div>
					</div>
					<div className="rounded border overflow-x-auto">
						<table className="min-w-[900px] text-sm">
							<thead>
								<tr className="text-left">
									<th className="py-2 px-3">ID</th>
									<th className="py-2 px-3">Usuario</th>
									<th className="py-2 px-3">Producto</th>
									<th className="py-2 px-3">Estado</th>
									<th className="py-2 px-3">Importe</th>
									<th className="py-2 px-3">Moneda</th>
									<th className="py-2 px-3">Creado</th>
								</tr>
							</thead>
							<tbody>
                                {filteredPayments.map((p:any) => (
									<tr key={p.id} className="border-t">
										<td className="py-2 px-3">{p.id}</td>
										<td className="py-2 px-3">{p.userId || '-'}</td>
										<td className="py-2 px-3">{p.productId || '-'}</td>
										<td className="py-2 px-3">{p.status || '-'}</td>
										<td className="py-2 px-3">{typeof p.amount === 'number' ? p.amount.toLocaleString('es-AR') : '-'}</td>
										<td className="py-2 px-3">{p.currency || '-'}</td>
                                        <td className="py-2 px-3">{typeof p.createdAt === 'string' ? p.createdAt : (p?.createdAt?.toDate?.() ? p.createdAt.toDate().toISOString() : (typeof p?.createdAt?._seconds === 'number' ? new Date(p.createdAt._seconds * 1000 + Math.round((p.createdAt._nanoseconds||0)/1e6)).toISOString() : '-'))}</td>
									</tr>
								))}
								{!filteredPayments.length && (
									<tr>
										<td className="py-6 px-3 text-gray-500" colSpan={7}>{paymentsLoading ? 'Cargando…' : 'Sin datos'}</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
					<div className="flex justify-end">
						<button
							className="rounded border px-3 py-1 text-sm disabled:opacity-50"
							disabled={!paymentsNext || paymentsLoading}
							onClick={async () => {
								try {
									setPaymentsLoading(true);
									const auth = getAuth();
									const cu = auth.currentUser;
									if (!cu) throw new Error('Usuario no autenticado');
									const token = await getIdToken(cu, true);
									const url = new URL('/api/admin/payments', window.location.origin);
									url.searchParams.set('limit', '50');
									if (paymentsStatus) url.searchParams.set('status', paymentsStatus);
									if (paymentsNext) url.searchParams.set('startAfter', paymentsNext);
									const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
									const data = await res.json();
									setPayments([...payments, ...(Array.isArray(data.items) ? data.items : [])]);
									setPaymentsNext(data.nextCursor);
								} catch {
									// noop
								} finally {
									setPaymentsLoading(false);
								}
						}}
						>
							Cargar más
						</button>
					</div>
				</div>
			)}


			{/* Jugadores */}
			{activeTab === 'players' && (
				<div className="space-y-3">
					<div className="flex items-center justify-between gap-2 flex-wrap">
						<h2 className="text-lg font-medium">Jugadores</h2>
						<div className="flex items-center gap-2 flex-wrap">
							<select
								className="rounded border px-2 py-1 text-sm"
								value={playersClubFilter}
								onChange={(e) => setPlayersClubFilter(e.target.value)}
							>
								<option value="">Todos los clubes</option>
								{clubsList.map((c: any) => (
									<option key={c.id} value={c.name || c.id}>
											{c.name || c.id}
										</option>
								))}
								{!clubsList.length && !clubsListLoading && <option value="" disabled>Sin clubes cargados</option>}
							</select>
							<input className="rounded border px-2 py-1 text-sm" placeholder="Buscar ID/Email/Nombre" value={playersQuery} onChange={(e)=>setPlayersQuery(e.target.value)} />
							<button className="rounded border px-3 py-1 text-sm" onClick={() => {
                                const headers = ['id','name','email','club','playerLevel','status','createdAt'];
                                const rows = filteredPlayers.map((p:any) => [p.id,p.name,p.email,p.club||'',p.playerLevel,p.status, typeof p.createdAt === 'string' ? p.createdAt : (p?.createdAt?.toDate?.() ? p.createdAt.toDate().toISOString() : (typeof p?.createdAt?._seconds === 'number' ? new Date(p.createdAt._seconds * 1000 + Math.round((p.createdAt._nanoseconds||0)/1e6)).toISOString() : ''))]);
								toCsvAndDownload('players.csv', headers, rows);
							}}>Exportar CSV</button>
						</div>
						<button
							className="rounded border px-3 py-1 text-sm"
							onClick={async () => {
								try {
									setPlayersLoading(true);
									const auth = getAuth();
									const cu = auth.currentUser;
									if (!cu) throw new Error('Usuario no autenticado');
									const token = await getIdToken(cu, true);
									const search = playersQuery.trim();
									const url = new URL('/api/admin/players', window.location.origin);
									if (search) url.searchParams.set('q', search);
									if (playersClubFilter) url.searchParams.set('club', playersClubFilter);
									if (!search && !playersClubFilter) url.searchParams.set('limit', '50');
									const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
									const data = await res.json();
									setPlayers(Array.isArray(data.items) ? data.items : []);
									setPlayersNext(search || playersClubFilter ? undefined : data.nextCursor);
								} catch {
									// noop
								} finally {
									setPlayersLoading(false);
								}
							}}
						>
							{playersQuery.trim() || playersClubFilter ? 'Buscar' : (players.length ? 'Refrescar' : 'Cargar')}
						</button>
					</div>
					<div className="rounded border overflow-x-auto">
						<table className="min-w-[800px] text-sm">
							<thead>
								<tr className="text-left">
									<th className="py-2 px-3">ID</th>
									<th className="py-2 px-3">Nombre</th>
									<th className="py-2 px-3">Email</th>
									<th className="py-2 px-3">Club</th>
									<th className="py-2 px-3">Nivel</th>
									<th className="py-2 px-3">Estado</th>
									<th className="py-2 px-3">Creado</th>
									<th className="py-2 px-3">Regalar</th>
								</tr>
							</thead>
							<tbody>
                                {filteredPlayers.map((p:any) => (
                                    <tr key={p.id} className="border-t">
                                        <td className="py-2 px-3">
                                            <Link href={`/admin/players/${p.id}`} className="underline">
                                                {p.id}
                                            </Link>
                                        </td>
                                        <td className="py-2 px-3">{p.name || '-'}</td>
                                        <td className="py-2 px-3">{p.email || '-'}</td>
										<td className="py-2 px-3">{p.club || '-'}</td>
                                        <td className="py-2 px-3">{p.playerLevel || '-'}</td>
                                        <td className="py-2 px-3">{p.status || '-'}</td>
                                        <td className="py-2 px-3">{typeof p.createdAt === 'string' ? p.createdAt : (p?.createdAt?.toDate?.() ? p.createdAt.toDate().toISOString() : (typeof p?.createdAt?._seconds === 'number' ? new Date(p.createdAt._seconds * 1000 + Math.round((p.createdAt._nanoseconds||0)/1e6)).toISOString() : '-'))}</td>
										<td className="py-2 px-3">
											<PlayerGiftDropdown onGift={async (count) => {
												try {
													const auth = getAuth();
													const cu = auth.currentUser;
													if (!cu) throw new Error('No autenticado');
													const token = await getIdToken(cu, true);
													const res = await fetch('/api/admin/gift-player', {
														method: 'POST',
														headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
														body: JSON.stringify({ userId: p.id, count }),
													});
													const data = await res.json();
													if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
													alert(data?.message || 'Listo');
												} catch (e: any) {
													alert(e?.message || 'Error');
												}
											}} />
										</td>
                                    </tr>
                                ))}
								{!filteredPlayers.length && (
									<tr>
										<td className="py-6 px-3 text-gray-500" colSpan={8}>{playersLoading ? 'Cargando…' : 'Sin datos'}</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
					<div className="flex justify-end">
						<button
							className="rounded border px-3 py-1 text-sm disabled:opacity-50"
							disabled={!playersNext || playersLoading}
							onClick={async () => {
								try {
									setPlayersLoading(true);
									const auth = getAuth();
									const cu = auth.currentUser;
									if (!cu) throw new Error('Usuario no autenticado');
									const token = await getIdToken(cu, true);
									const url = new URL('/api/admin/players', window.location.origin);
									url.searchParams.set('limit', '50');
									if (playersNext) url.searchParams.set('startAfter', playersNext);
									const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
									const data = await res.json();
									setPlayers([...players, ...(Array.isArray(data.items) ? data.items : [])]);
									setPlayersNext(data.nextCursor);
								} catch {
									// noop
								} finally {
									setPlayersLoading(false);
								}
						}}
						>
							Cargar más
						</button>
					</div>
				</div>
			)}

			{/* Entrenadores */}
			{activeTab === 'coaches' && (
				<div className="space-y-3">
					<div className="flex items-center justify-between gap-2 flex-wrap">
						<h2 className="text-lg font-medium">Entrenadores</h2>
						<div className="flex items-center gap-2">
							<input className="rounded border px-2 py-1 text-sm" placeholder="Buscar ID/Email/Nombre" value={coachesQuery} onChange={(e)=>setCoachesQuery(e.target.value)} />
							<button className="rounded border px-3 py-1 text-sm" onClick={() => {
								const headers = ['id','name','email','status','ratePerAnalysis','createdAt'];
								const rows = filteredCoaches.map((c:any) => [c.id,c.name,c.email,c.status,c.ratePerAnalysis,c.createdAt]);
								toCsvAndDownload('coaches.csv', headers, rows);
							}}>Exportar CSV</button>
						</div>
						<button
							className="rounded border px-3 py-1 text-sm"
							onClick={async () => {
								try {
									setCoachesLoading(true);
									const auth = getAuth();
									const cu = auth.currentUser;
									if (!cu) throw new Error('Usuario no autenticado');
									const token = await getIdToken(cu, true);
									const url = new URL('/api/admin/coaches', window.location.origin);
									url.searchParams.set('limit', '50');
									const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
									const data = await res.json();
									setCoaches(Array.isArray(data.items) ? data.items : []);
									setCoachesNext(data.nextCursor);
								} catch {
									// noop
								} finally {
									setCoachesLoading(false);
								}
							}}
						>
							{coaches.length ? 'Refrescar' : 'Cargar'}
						</button>
					</div>
					<div className="rounded border overflow-x-auto">
						<table className="min-w-[800px] text-sm">
							<thead>
								<tr className="text-left">
									<th className="py-2 px-3">ID</th>
									<th className="py-2 px-3">Nombre</th>
									<th className="py-2 px-3">Email</th>
									<th className="py-2 px-3">Estado</th>
									<th className="py-2 px-3">Tarifa</th>
									<th className="py-2 px-3">Creado</th>
									<th className="py-2 px-3">Acciones</th>
								</tr>
							</thead>
							<tbody>
                                {filteredCoaches.map((c:any) => (
                                    <tr key={c.id} className="border-t">
                                        <td className="py-2 px-3">
                                            <Link href={`/admin/coaches/${c.id}`} className="underline">
                                                {c.id}
                                            </Link>
                                        </td>
                                        <td className="py-2 px-3">{c.name || '-'}</td>
                                        <td className="py-2 px-3">{c.email || '-'}</td>
                                        <td className="py-2 px-3">{c.status || '-'}</td>
                                        <td className="py-2 px-3">{typeof c.ratePerAnalysis === 'number' ? c.ratePerAnalysis : '-'}</td>
                                        <td className="py-2 px-3">{typeof c.createdAt === 'string' ? c.createdAt : (c?.createdAt?.toDate?.() ? c.createdAt.toDate().toISOString() : (typeof c?.createdAt?._seconds === 'number' ? new Date(c.createdAt._seconds * 1000 + Math.round((c.createdAt._nanoseconds||0)/1e6)).toISOString() : '-'))}</td>
										<td className="py-2 px-3">
											<div className="flex flex-wrap gap-2">
												<button
													className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
													disabled={coachUpdatingId === c.id}
													onClick={() => {
														const nextStatus = c.status === 'active' ? 'suspended' : 'active';
														const label = nextStatus === 'active' ? 'activar' : 'suspender';
														if (!confirm(`¿Seguro que querés ${label} a este entrenador?`)) return;
														updateCoach(c.id, { status: nextStatus });
													}}
												>
													{c.status === 'active' ? 'Suspender' : 'Activar'}
												</button>
												<button
													className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
													disabled={coachUpdatingId === c.id}
													onClick={() => {
														const currentRate = typeof c.ratePerAnalysis === 'number' ? String(c.ratePerAnalysis) : '';
														const input = prompt('Nueva tarifa por análisis (ARS):', currentRate);
														if (input == null) return;
														const rate = Number(String(input).trim());
														if (Number.isNaN(rate) || rate < 0) {
															alert('Tarifa inválida');
															return;
														}
														updateCoach(c.id, { ratePerAnalysis: rate });
													}}
												>
													Cambiar tarifa
												</button>
											</div>
										</td>
                                    </tr>
                                ))}
								{!filteredCoaches.length && (
									<tr>
										<td className="py-6 px-3 text-gray-500" colSpan={7}>{coachesLoading ? 'Cargando…' : 'Sin datos'}</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
					<div className="flex justify-end">
						<button
							className="rounded border px-3 py-1 text-sm disabled:opacity-50"
							disabled={!coachesNext || coachesLoading}
							onClick={async () => {
								try {
									setCoachesLoading(true);
									const auth = getAuth();
									const cu = auth.currentUser;
									if (!cu) throw new Error('Usuario no autenticado');
									const token = await getIdToken(cu, true);
									const url = new URL('/api/admin/coaches', window.location.origin);
									url.searchParams.set('limit', '50');
									if (coachesNext) url.searchParams.set('startAfter', coachesNext);
									const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
									const data = await res.json();
									setCoaches([...coaches, ...(Array.isArray(data.items) ? data.items : [])]);
									setCoachesNext(data.nextCursor);
								} catch {
									// noop
								} finally {
									setCoachesLoading(false);
								}
						}}
						>
							Cargar más
						</button>
					</div>
				</div>
			)}

			{/* Clubes */}
			{activeTab === 'clubs' && (
				<div className="space-y-4">
					{/* Acceso gratis por club + coach (La Emilia, Victor Baldo, etc.) */}
					<div className="rounded border p-4 bg-amber-50/50 border-amber-200 space-y-4">
						<h2 className="text-lg font-medium">Acceso gratis por club y entrenador</h2>
						<p className="text-sm text-muted-foreground">
							Asignar entrenador y regalar análisis/revisiones a jugadores de un club. Cada jugador recibe el regalo solo una vez (no se suma si vuelve a aplicar).
						</p>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							<div>
								<label className="text-sm font-medium block mb-1">Nombre del club</label>
								<select
									className="w-full rounded border px-2 py-1.5 text-sm"
									value={clubBulkName}
									onChange={(e) => { setClubBulkName(e.target.value); setClubBulkPreview(null); setClubBulkResult(null); }}
								>
									<option value="">-- Seleccionar club --</option>
									{clubsList.map((c: any) => (
										<option key={c.id} value={c.name || c.id}>
											{c.name || c.id}
										</option>
									))}
									{!clubsList.length && <option value="" disabled>Sin clubes — cargá abajo y refrescá</option>}
								</select>
								<p className="text-xs text-muted-foreground mt-0.5">Clubes creados/autorizados. Coincide con el campo club del jugador.</p>
							</div>
							<div>
								<label className="text-sm font-medium block mb-1">Entrenador (ID o buscar)</label>
								<select
									className="w-full rounded border px-2 py-1.5 text-sm"
									value={clubBulkCoachId}
									onChange={(e) => { setClubBulkCoachId(e.target.value); setClubBulkResult(null); }}
								>
									<option value="">-- Seleccionar --</option>
									{coaches.map((c: any) => (
										<option key={c.id} value={c.id}>
											{c.name || c.email || c.id} ({c.id})
										</option>
									))}
									{!coaches.length && <option value="" disabled>Cargar entrenadores primero</option>}
								</select>
							</div>
							<div>
								<label className="text-sm font-medium block mb-1">Regalar análisis</label>
								<input
									type="number"
									min={0}
									className="w-full rounded border px-2 py-1.5 text-sm"
									value={clubBulkGiftAnalyses}
									onChange={(e) => setClubBulkGiftAnalyses(parseInt(e.target.value, 10) || 0)}
								/>
							</div>
							<div>
								<label className="text-sm font-medium block mb-1">Regalar revisiones coach</label>
								<input
									type="number"
									min={0}
									className="w-full rounded border px-2 py-1.5 text-sm"
									value={clubBulkGiftReviews}
									onChange={(e) => setClubBulkGiftReviews(parseInt(e.target.value, 10) || 0)}
								/>
							</div>
						</div>
						<div className="flex flex-wrap gap-2">
							<button
								className="rounded border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
								disabled={clubBulkLoading}
								onClick={async () => {
									try {
										setClubBulkLoading(true);
										setClubBulkResult(null);
										const auth = getAuth();
										const cu = auth.currentUser;
										if (!cu) throw new Error('Usuario no autenticado');
										const token = await getIdToken(cu, true);
										const url = new URL('/api/admin/bulk-club-coach', window.location.origin);
										url.searchParams.set('clubName', clubBulkName.trim());
										const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
										const data = await res.json();
										if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
										setClubBulkPreview({
											count: data.count,
											players: data.players || [],
											nuevos: data.nuevos ?? data.count,
										});
									} catch (e: any) {
										alert(e?.message || 'Error al buscar');
									} finally {
										setClubBulkLoading(false);
									}
								}}
							>
								{clubBulkLoading ? 'Buscando…' : 'Vista previa'}
							</button>
							<button
								className="rounded border px-3 py-1.5 text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
								disabled={clubBulkExecuting || !clubBulkCoachId || !clubBulkName.trim()}
								onClick={async () => {
									const nuevos = clubBulkPreview?.nuevos ?? clubBulkPreview?.count ?? 0;
									const confirmMsg = `¿Aplicar a ${clubBulkPreview?.count ?? '?'} jugador(es) del club "${clubBulkName}"?\n- Coach asignado a todos\n- ${nuevos} recibirán el regalo (análisis: ${clubBulkGiftAnalyses}, revisiones: ${clubBulkGiftReviews})\n- Los que ya recibieron antes no se suman\n¿Continuar?`;
									if (!confirm(confirmMsg)) return;
									try {
										setClubBulkExecuting(true);
										setClubBulkResult(null);
										const auth = getAuth();
										const cu = auth.currentUser;
										if (!cu) throw new Error('Usuario no autenticado');
										const token = await getIdToken(cu, true);
										const res = await fetch('/api/admin/bulk-club-coach', {
											method: 'POST',
											headers: {
												Authorization: `Bearer ${token}`,
												'Content-Type': 'application/json',
											},
											body: JSON.stringify({
												clubName: clubBulkName.trim(),
												coachId: clubBulkCoachId,
												giftAnalyses: clubBulkGiftAnalyses,
												giftCoachReviews: clubBulkGiftReviews,
											}),
										});
										const data = await res.json();
										if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
										setClubBulkResult(data?.message || `Listo. ${data?.updated ?? 0} actualizados.`);
										setClubBulkPreview((prev) => prev ? { ...prev, count: data?.updated ?? prev.count } : null);
									} catch (e: any) {
										alert(e?.message || 'Error al aplicar');
									} finally {
										setClubBulkExecuting(false);
									}
								}}
							>
								{clubBulkExecuting ? 'Aplicando…' : 'Aplicar en bloque'}
							</button>
						</div>
						{clubBulkPreview && (
							<div className="text-sm">
								<p className="font-medium text-green-700">
									{clubBulkPreview.count} jugador(es) con club &quot;{clubBulkName}&quot;
									{typeof clubBulkPreview.nuevos === 'number' && clubBulkPreview.nuevos < clubBulkPreview.count && (
										<span className="text-amber-600 ml-1">
											({clubBulkPreview.nuevos} recibirán regalo, {clubBulkPreview.count - clubBulkPreview.nuevos} ya lo tenían)
										</span>
									)}
								</p>
								<div className="mt-2 max-h-40 overflow-y-auto rounded border bg-white p-2">
									{clubBulkPreview.players.slice(0, 20).map((p: any) => (
										<div key={p.id} className="flex gap-2 py-0.5">
											<span className="font-mono text-xs">{p.id}</span>
											<span>{p.name}</span>
											<span className="text-muted-foreground">{p.email}</span>
										</div>
									))}
									{clubBulkPreview.players.length > 20 && (
										<p className="text-muted-foreground pt-1">… y {clubBulkPreview.players.length - 20} más</p>
									)}
								</div>
							</div>
						)}
						{clubBulkResult && (
							<div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
								{clubBulkResult}
							</div>
						)}
						{!coaches.length && (
							<button
								className="rounded border px-3 py-1 text-sm"
								onClick={async () => {
									try {
										setCoachesLoading(true);
										const auth = getAuth();
										const cu = auth.currentUser;
										if (!cu) throw new Error('Usuario no autenticado');
										const token = await getIdToken(cu, true);
										const res = await fetch('/api/admin/coaches?limit=200', { headers: { Authorization: `Bearer ${token}` } });
										const data = await res.json();
										setCoaches(Array.isArray(data.items) ? data.items : []);
									} catch {
										// noop
									} finally {
										setCoachesLoading(false);
									}
								}}
							>
								{coachesLoading ? 'Cargando…' : 'Cargar entrenadores'}
							</button>
						)}
					</div>

					{/* Clubes creados */}
					<div className="rounded border p-4 space-y-3">
						<div className="flex items-center justify-between gap-2 flex-wrap">
							<h2 className="text-lg font-medium">Clubes creados / autorizados</h2>
							<button
								className="rounded border px-3 py-1 text-sm"
								disabled={clubsListLoading}
								onClick={async () => {
									try {
										setClubsListLoading(true);
										const auth = getAuth();
										const cu = auth.currentUser;
										if (!cu) throw new Error('Usuario no autenticado');
										const token = await getIdToken(cu, true);
										const res = await fetch('/api/admin/clubs?limit=100', { headers: { Authorization: `Bearer ${token}` } });
										const data = await res.json();
										setClubsList(Array.isArray(data.items) ? data.items : []);
									} catch {
										// noop
									} finally {
										setClubsListLoading(false);
									}
								}}
							>
								{clubsListLoading ? 'Cargando…' : (clubsList.length ? 'Refrescar clubes' : 'Cargar clubes')}
							</button>
						</div>
						<div className="rounded border overflow-x-auto">
							<table className="min-w-[600px] text-sm">
								<thead>
									<tr className="text-left">
										<th className="py-2 px-3">Nombre</th>
										<th className="py-2 px-3">Email</th>
										<th className="py-2 px-3">Ciudad</th>
										<th className="py-2 px-3">Provincia</th>
										<th className="py-2 px-3">Estado</th>
										<th className="py-2 px-3">ID</th>
									</tr>
								</thead>
								<tbody>
									{clubsList.map((c: any) => (
										<tr key={c.id} className="border-t">
											<td className="py-2 px-3 font-medium">{c.name || '-'}</td>
											<td className="py-2 px-3">{c.email || '-'}</td>
											<td className="py-2 px-3">{c.city || '-'}</td>
											<td className="py-2 px-3">{c.province || '-'}</td>
											<td className="py-2 px-3">Operativo</td>
											<td className="py-2 px-3 font-mono text-xs">{c.id}</td>
										</tr>
									))}
									{!clubsList.length && (
										<tr>
											<td className="py-6 px-3 text-gray-500" colSpan={6}>
												{clubsListLoading ? 'Cargando…' : 'Pulsá "Cargar clubes" para ver los clubes creados'}
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>

					<div className="flex items-center justify-between gap-2 flex-wrap">
						<h2 className="text-lg font-medium">Alta de clubes</h2>
						<button
							className="rounded border px-3 py-1 text-sm"
							onClick={async () => {
								try {
									setClubRequestsLoading(true);
									const auth = getAuth();
									const cu = auth.currentUser;
									if (!cu) throw new Error('Usuario no autenticado');
									const token = await getIdToken(cu, true);
									const url = new URL('/api/admin/club-requests', window.location.origin);
									url.searchParams.set('status', 'pending');
									url.searchParams.set('limit', '100');
									const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
									const data = await res.json();
									setClubRequests(Array.isArray(data.items) ? data.items : []);
								} catch {
									// noop
								} finally {
									setClubRequestsLoading(false);
								}
							}}
						>
							{clubRequests.length ? 'Refrescar solicitudes' : 'Cargar solicitudes'}
						</button>
					</div>
					<div className="rounded border overflow-x-auto">
						<table className="min-w-[700px] text-sm">
							<thead>
								<tr className="text-left">
									<th className="py-2 px-3">Club solicitado</th>
									<th className="py-2 px-3">Jugador</th>
									<th className="py-2 px-3">Email</th>
									<th className="py-2 px-3">Creado</th>
									<th className="py-2 px-3">Acciones</th>
								</tr>
							</thead>
							<tbody>
								{clubRequests.map((req) => (
									<tr key={req.id} className="border-t">
										<td className="py-2 px-3">{req.proposedName || '-'}</td>
										<td className="py-2 px-3">{req.playerName || req.playerId || '-'}</td>
										<td className="py-2 px-3">{req.playerEmail || '-'}</td>
										<td className="py-2 px-3">{req.createdAt || '-'}</td>
										<td className="py-2 px-3">
											<button
												className="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
												disabled={clubRequestsLoading}
												onClick={async () => {
													try {
														const auth = getAuth();
														const cu = auth.currentUser;
														if (!cu) throw new Error('Usuario no autenticado');
														const token = await getIdToken(cu, true);
														const res = await fetch('/api/admin/club-requests', {
															method: 'PATCH',
															headers: {
																Authorization: `Bearer ${token}`,
																'Content-Type': 'application/json',
															},
															body: JSON.stringify({ id: req.id, status: 'resolved' }),
														});
														const data = await res.json();
														if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
														setClubRequests((prev) => prev.filter((r) => r.id !== req.id));
													} catch (e: any) {
														alert(e?.message || 'Error actualizando solicitud');
													}
												}}
											>
												Marcar como cargado
											</button>
										</td>
									</tr>
								))}
								{!clubRequests.length && (
									<tr>
										<td className="py-6 px-3 text-gray-500" colSpan={5}>
											{clubRequestsLoading ? 'Cargando…' : 'Sin solicitudes pendientes'}
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
					<ClubAdminForm onClubCreated={refreshClubsList} />
				</div>
			)}
		</div>
	);
}


