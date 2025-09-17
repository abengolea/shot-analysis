"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getAuth, getIdToken } from "firebase/auth";

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

	const [payments, setPayments] = useState<any[]>([]);
	const [paymentsNext, setPaymentsNext] = useState<string | undefined>(undefined);
	const [paymentsLoading, setPaymentsLoading] = useState(false);
	const [paymentsStatus, setPaymentsStatus] = useState<string>("");

	const [subs, setSubs] = useState<any[]>([]);
	const [subsNext, setSubsNext] = useState<string | undefined>(undefined);
	const [subsLoading, setSubsLoading] = useState(false);

	// Filtros de búsqueda
	const [playersQuery, setPlayersQuery] = useState<string>("");
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

	const Tabs = useMemo(() => [
		{ id: 'home', label: 'Inicio' },
		{ id: 'players', label: 'Jugadores' },
		{ id: 'coaches', label: 'Entrenadores' },
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

	return (
		<div className="p-6 space-y-6">
			<h1 className="text-xl font-semibold">Admin</h1>

			{/* Tabs */}
			<div className="flex gap-2 border-b">
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
								} catch (e) {
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
								} catch (e) {
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
									} catch (e) {
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
								} catch (e) {
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
						<div className="flex items-center gap-2">
							<input className="rounded border px-2 py-1 text-sm" placeholder="Buscar ID/Email/Nombre" value={playersQuery} onChange={(e)=>setPlayersQuery(e.target.value)} />
							<button className="rounded border px-3 py-1 text-sm" onClick={() => {
                                const headers = ['id','name','email','playerLevel','status','createdAt'];
                                const rows = filteredPlayers.map((p:any) => [p.id,p.name,p.email,p.playerLevel,p.status, typeof p.createdAt === 'string' ? p.createdAt : (p?.createdAt?.toDate?.() ? p.createdAt.toDate().toISOString() : (typeof p?.createdAt?._seconds === 'number' ? new Date(p.createdAt._seconds * 1000 + Math.round((p.createdAt._nanoseconds||0)/1e6)).toISOString() : ''))]);
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
									const url = new URL('/api/admin/players', window.location.origin);
									url.searchParams.set('limit', '50');
									const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
									const data = await res.json();
									setPlayers(Array.isArray(data.items) ? data.items : []);
									setPlayersNext(data.nextCursor);
								} catch (e) {
									// noop
								} finally {
									setPlayersLoading(false);
								}
							}}
						>
							{players.length ? 'Refrescar' : 'Cargar'}
						</button>
					</div>
					<div className="rounded border overflow-x-auto">
						<table className="min-w-[800px] text-sm">
							<thead>
								<tr className="text-left">
									<th className="py-2 px-3">ID</th>
									<th className="py-2 px-3">Nombre</th>
									<th className="py-2 px-3">Email</th>
									<th className="py-2 px-3">Nivel</th>
									<th className="py-2 px-3">Estado</th>
									<th className="py-2 px-3">Creado</th>
								</tr>
							</thead>
							<tbody>
                                {filteredPlayers.map((p:any) => (
									<tr key={p.id} className="border-t">
										<td className="py-2 px-3">{p.id}</td>
										<td className="py-2 px-3">{p.name || '-'}</td>
										<td className="py-2 px-3">{p.email || '-'}</td>
										<td className="py-2 px-3">{p.playerLevel || '-'}</td>
										<td className="py-2 px-3">{p.status || '-'}</td>
                                        <td className="py-2 px-3">{typeof p.createdAt === 'string' ? p.createdAt : (p?.createdAt?.toDate?.() ? p.createdAt.toDate().toISOString() : (typeof p?.createdAt?._seconds === 'number' ? new Date(p.createdAt._seconds * 1000 + Math.round((p.createdAt._nanoseconds||0)/1e6)).toISOString() : '-'))}</td>
									</tr>
								))}
								{!filteredPlayers.length && (
									<tr>
										<td className="py-6 px-3 text-gray-500" colSpan={6}>{playersLoading ? 'Cargando…' : 'Sin datos'}</td>
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
								} catch (e) {
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
								} catch (e) {
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
								</tr>
							</thead>
							<tbody>
								{filteredCoaches.map((c:any) => (
									<tr key={c.id} className="border-t">
										<td className="py-2 px-3">{c.id}</td>
										<td className="py-2 px-3">{c.name || '-'}</td>
										<td className="py-2 px-3">{c.email || '-'}</td>
										<td className="py-2 px-3">{c.status || '-'}</td>
										<td className="py-2 px-3">{typeof c.ratePerAnalysis === 'number' ? c.ratePerAnalysis : '-'}</td>
                                        <td className="py-2 px-3">{typeof c.createdAt === 'string' ? c.createdAt : (c?.createdAt?.toDate?.() ? c.createdAt.toDate().toISOString() : (typeof c?.createdAt?._seconds === 'number' ? new Date(c.createdAt._seconds * 1000 + Math.round((c.createdAt._nanoseconds||0)/1e6)).toISOString() : '-'))}</td>
									</tr>
								))}
								{!filteredCoaches.length && (
									<tr>
										<td className="py-6 px-3 text-gray-500" colSpan={6}>{coachesLoading ? 'Cargando…' : 'Sin datos'}</td>
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
								} catch (e) {
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
		</div>
	);
}


