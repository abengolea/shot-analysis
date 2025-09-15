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
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-medium">Suscripciones (History+)</h2>
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
								{subs.map((w) => (
									<tr key={w.id} className="border-t">
										<td className="py-2 px-3">{w.userId || w.id}</td>
										<td className="py-2 px-3">{w.historyPlusActive ? 'Sí' : 'No'}</td>
										<td className="py-2 px-3">{w.historyPlusValidUntil || '-'}</td>
										<td className="py-2 px-3">{typeof w.credits === 'number' ? w.credits : '-'}</td>
										<td className="py-2 px-3">{w.updatedAt || '-'}</td>
									</tr>
								))}
								{!subs.length && (
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
								{payments.map((p) => (
									<tr key={p.id} className="border-t">
										<td className="py-2 px-3">{p.id}</td>
										<td className="py-2 px-3">{p.userId || '-'}</td>
										<td className="py-2 px-3">{p.productId || '-'}</td>
										<td className="py-2 px-3">{p.status || '-'}</td>
										<td className="py-2 px-3">{typeof p.amount === 'number' ? p.amount.toLocaleString('es-AR') : '-'}</td>
										<td className="py-2 px-3">{p.currency || '-'}</td>
										<td className="py-2 px-3">{p.createdAt || '-'}</td>
									</tr>
								))}
								{!payments.length && (
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
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-medium">Jugadores</h2>
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
								{players.map((p) => (
									<tr key={p.id} className="border-t">
										<td className="py-2 px-3">{p.id}</td>
										<td className="py-2 px-3">{p.name || '-'}</td>
										<td className="py-2 px-3">{p.email || '-'}</td>
										<td className="py-2 px-3">{p.playerLevel || '-'}</td>
										<td className="py-2 px-3">{p.status || '-'}</td>
										<td className="py-2 px-3">{p.createdAt || '-'}</td>
									</tr>
								))}
								{!players.length && (
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
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-medium">Entrenadores</h2>
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
								{coaches.map((c) => (
									<tr key={c.id} className="border-t">
										<td className="py-2 px-3">{c.id}</td>
										<td className="py-2 px-3">{c.name || '-'}</td>
										<td className="py-2 px-3">{c.email || '-'}</td>
										<td className="py-2 px-3">{c.status || '-'}</td>
										<td className="py-2 px-3">{typeof c.ratePerAnalysis === 'number' ? c.ratePerAnalysis : '-'}</td>
										<td className="py-2 px-3">{c.createdAt || '-'}</td>
									</tr>
								))}
								{!coaches.length && (
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


