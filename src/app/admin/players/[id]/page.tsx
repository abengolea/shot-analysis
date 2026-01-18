import { adminDb } from "@/lib/firebase-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { adminUpdatePlayerStatus, adminUpdateWallet, adminSetHistoryPlus, adminSendPasswordReset, giftAnalyses, giftCoachReviews } from "@/app/actions";

// Server action wrappers with single-parameter signature for <form action>
export async function actionUpdatePlayerStatus(formData: FormData) { 'use server'; return await (adminUpdatePlayerStatus as any)(undefined, formData); }
export async function actionGiftAnalyses(formData: FormData) { 'use server'; return await (giftAnalyses as any)(undefined, formData); }
export async function actionGiftCoachReviews(formData: FormData) { 'use server'; return await (giftCoachReviews as any)(undefined, formData); }
export async function actionUpdateWallet(formData: FormData) { 'use server'; return await (adminUpdateWallet as any)(undefined, formData); }
export async function actionSetHistoryPlus(formData: FormData) { 'use server'; return await (adminSetHistoryPlus as any)(undefined, formData); }
export async function actionSendPasswordReset(formData: FormData) { 'use server'; return await (adminSendPasswordReset as any)(undefined, formData); }
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

async function getPlayerData(userId: string) {
  if (!adminDb) return null;
  const playerSnap = await adminDb.collection('players').doc(userId).get();
  if (!playerSnap.exists) return null;
  const walletSnap = await adminDb.collection('wallets').doc(userId).get();
  const getCreatedAtMs = (value: any): number => {
    if (!value) return 0;
    if (typeof value === 'number' || typeof value === 'string') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    }
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (typeof value?._seconds === 'number') {
      return value._seconds * 1000 + Math.round((value._nanoseconds || 0) / 1e6);
    }
    return 0;
  };
  const analysesByPlayerSnap = await adminDb.collection('analyses').where('playerId', '==', userId).get();
  let analysesByUserSnap: any = { docs: [], size: 0 };
  try {
    analysesByUserSnap = await adminDb.collection('analyses').where('userId', '==', userId).get();
  } catch (e) {
    console.warn('⚠️ Query admin por userId falló, usando solo playerId', e);
  }
  const analysisMap = new Map<string, any>();
  for (const d of analysesByPlayerSnap.docs) {
    analysisMap.set(d.id, { id: d.id, ...(d.data() as any) });
  }
  for (const d of analysesByUserSnap.docs) {
    if (!analysisMap.has(d.id)) {
      analysisMap.set(d.id, { id: d.id, ...(d.data() as any) });
    }
  }
  const latestAnalyses = Array.from(analysisMap.values())
    .sort((a, b) => getCreatedAtMs(b.createdAt) - getCreatedAtMs(a.createdAt))
    .slice(0, 10);
  const paymentsSnap = await adminDb.collection('payments').where('userId', '==', userId).orderBy('createdAt','desc').limit(10).get();
  const ticketsSnap = await adminDb.collection('tickets').where('userId', '==', userId).orderBy('updatedAt','desc').limit(10).get();
  const playerData = playerSnap.data() as any;
  const coachId = playerData?.coachId || null;
  const coachSnap = coachId ? await adminDb.collection('coaches').doc(String(coachId)).get() : null;
  return {
    id: userId,
    player: playerData,
    wallet: walletSnap.exists ? walletSnap.data() : null,
    analysesCount: new Set([
      ...analysesByPlayerSnap.docs.map((d) => d.id),
      ...analysesByUserSnap.docs.map((d) => d.id),
    ]).size,
    latestAnalyses,
    latestPayments: paymentsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })),
    latestTickets: ticketsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })),
    coach: coachSnap && coachSnap.exists ? { id: coachSnap.id, ...(coachSnap.data() as any) } : null,
  };
}

export default async function AdminPlayerDetailPage({ params }: { params: { id: string } }) {
  const data = await getPlayerData(params.id);
  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Jugador no encontrado.</p>
        <Link href="/admin?tab=players" className="underline">Volver</Link>
      </div>
    );
  }

  const { player, wallet, analysesCount, latestAnalyses, latestPayments, latestTickets, coach } = data as any;

  const statusVariant = player.status === 'active' ? 'default' : player.status === 'pending' ? 'secondary' : 'destructive';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold">{player.name || 'Jugador'}</h1>
          <p className="text-muted-foreground">{player.email}</p>
        </div>
        <Badge variant={statusVariant as any} className="capitalize">{player.status || 'active'}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Métricas</CardTitle>
            <CardDescription>Uso reciente y totales</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Análisis realizados</div>
              <div className="text-2xl font-semibold">{analysesCount}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Gratis usados (año)</div>
              <div className="text-2xl font-semibold">{wallet?.freeAnalysesUsed ?? 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Créditos</div>
              <div className="text-2xl font-semibold">{wallet?.credits ?? 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Revisiones coach gratis</div>
              <div className="text-2xl font-semibold">{wallet?.freeCoachReviews ?? 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">History+ activo</div>
              <div className="text-2xl font-semibold">{wallet?.historyPlusActive ? 'Sí' : 'No'}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
            <CardDescription>Administrar plan y créditos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">Estado de la cuenta</div>
              <form action={actionUpdatePlayerStatus} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={data.id} />
                <select name="status" defaultValue={player.status || 'active'} className="border rounded px-2 py-1">
                  <option value="active">Activo</option>
                  <option value="pending">Pendiente</option>
                  <option value="suspended">Suspendido</option>
                </select>
                <Button type="submit" size="sm">Guardar</Button>
              </form>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Wallet</div>
              <form action={actionUpdateWallet} className="grid grid-cols-2 gap-2">
                <input type="hidden" name="userId" defaultValue={data.id} />
                <input type="hidden" name="redirectTo" defaultValue={`/admin/players/${data.id}`} />
                <label className="text-sm text-muted-foreground">Créditos</label>
                <input name="credits" type="number" defaultValue={wallet?.credits ?? 0} className="border rounded px-2 py-1" />
                <label className="text-sm text-muted-foreground">Gratis usados</label>
                <input name="freeAnalysesUsed" type="number" defaultValue={wallet?.freeAnalysesUsed ?? 0} className="border rounded px-2 py-1" />
                <label className="text-sm text-muted-foreground">Revisiones coach gratis</label>
                <input name="freeCoachReviews" type="number" defaultValue={wallet?.freeCoachReviews ?? 0} className="border rounded px-2 py-1" />
                <div className="col-span-2 flex justify-end">
                  <Button type="submit" size="sm">Guardar</Button>
                </div>
              </form>
              <div className="text-xs text-muted-foreground">Regalar análisis IA</div>
              <div className="flex flex-wrap items-center gap-2">
                <form action={actionGiftAnalyses}>
                  <input type="hidden" name="userId" value={data.id} />
                  <input type="hidden" name="count" value={1} />
                  <Button type="submit" variant="outline" size="sm">1 análisis</Button>
                </form>
                <form action={actionGiftAnalyses}>
                  <input type="hidden" name="userId" value={data.id} />
                  <input type="hidden" name="count" value={3} />
                  <Button type="submit" variant="outline" size="sm">3 análisis</Button>
                </form>
                <form action={actionGiftAnalyses}>
                  <input type="hidden" name="userId" value={data.id} />
                  <input type="hidden" name="count" value={10} />
                  <Button type="submit" variant="outline" size="sm">10 análisis</Button>
                </form>
                <form action={actionGiftAnalyses}>
                  <input type="hidden" name="userId" value={data.id} />
                  <input type="hidden" name="count" value={20} />
                  <Button type="submit" variant="outline" size="sm">20 análisis</Button>
                </form>
              </div>
              <div className="text-xs text-muted-foreground">Regalar revisiones de coach</div>
              <div className="flex flex-wrap items-center gap-2">
                <form action={actionGiftCoachReviews}>
                  <input type="hidden" name="userId" value={data.id} />
                  <input type="hidden" name="count" value={1} />
                  <Button type="submit" variant="outline" size="sm">1 revisión</Button>
                </form>
                <form action={actionGiftCoachReviews}>
                  <input type="hidden" name="userId" value={data.id} />
                  <input type="hidden" name="count" value={3} />
                  <Button type="submit" variant="outline" size="sm">3 revisiones</Button>
                </form>
                <form action={actionGiftCoachReviews}>
                  <input type="hidden" name="userId" value={data.id} />
                  <input type="hidden" name="count" value={10} />
                  <Button type="submit" variant="outline" size="sm">10 revisiones</Button>
                </form>
                <form action={actionGiftCoachReviews}>
                  <input type="hidden" name="userId" value={data.id} />
                  <input type="hidden" name="count" value={20} />
                  <Button type="submit" variant="outline" size="sm">20 revisiones</Button>
                </form>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">History+</div>
              <form action={actionSetHistoryPlus} className="grid grid-cols-2 gap-2 items-center">
                <input type="hidden" name="userId" value={data.id} />
                <label className="text-sm text-muted-foreground">Activo</label>
                <input name="historyPlusActive" type="checkbox" defaultChecked={!!wallet?.historyPlusActive} />
                <label className="text-sm text-muted-foreground">Vence</label>
                <input name="historyPlusValidUntil" type="date" defaultValue={wallet?.historyPlusValidUntil ? new Date(wallet.historyPlusValidUntil).toISOString().slice(0,10) : ''} className="border rounded px-2 py-1" />
                <div className="col-span-2 flex justify-end">
                  <Button type="submit" size="sm">Guardar</Button>
                </div>
              </form>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Seguridad</div>
              <form action={actionSendPasswordReset} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={data.id} />
                <Button type="submit" variant="outline" size="sm">Enviar reset de contraseña</Button>
              </form>
            </div>

            <Link href="/admin?tab=players" className="inline-block underline">Volver al listado</Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Perfil</CardTitle>
                <CardDescription>Datos del jugador</CardDescription>
              </div>
              {coach?.id && (
                <Link href={`/admin/coaches/${coach.id}`} className="text-sm underline">Ver coach</Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Nivel</div>
              <div className="font-medium">{player.playerLevel || '-'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Categoría de edad</div>
              <div className="font-medium">{player.ageGroup || '-'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Posición</div>
              <div className="font-medium">{player.position || '-'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">País</div>
              <div className="font-medium">{player.country || '-'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Altura (cm)</div>
              <div className="font-medium">{player.height || '-'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Envergadura (cm)</div>
              <div className="font-medium">{player.wingspan || '-'}</div>
            </div>
            <div className="col-span-2">
              <div className="text-muted-foreground">Coach asignado</div>
              <div className="font-medium">{coach?.name ? `${coach.name} (${coach.id})` : (player.coachId || '-')}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Suscripción</CardTitle>
                <CardDescription>History+ y créditos</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">History+ activo</div>
              <div className="font-medium">{wallet?.historyPlusActive ? 'Sí' : 'No'}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">Vence</div>
              <div className="font-medium">{wallet?.historyPlusValidUntil ? new Date(wallet.historyPlusValidUntil).toLocaleDateString() : '-'}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">Créditos</div>
              <div className="font-medium">{wallet?.credits ?? 0}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">Revisiones coach gratis</div>
              <div className="font-medium">{wallet?.freeCoachReviews ?? 0}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">Gratis usados (año)</div>
              <div className="font-medium">{wallet?.freeAnalysesUsed ?? 0}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Análisis recientes</CardTitle>
                <CardDescription>Últimos análisis cargados por este jugador</CardDescription>
              </div>
              <Link href="/admin/revision-ia" className="text-sm underline">Ver todos</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded border overflow-x-auto">
              <table className="min-w-[700px] text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-2 px-3">ID</th>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Score</th>
                    <th className="py-2 px-3">Estado</th>
                    <th className="py-2 px-3">Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {(latestAnalyses || []).map((a: any) => (
                    <tr key={a.id} className="border-t">
                      <td className="py-2 px-3"><Link href={`/admin/revision-ia/${a.id}`} className="underline">{a.id}</Link></td>
                      <td className="py-2 px-3">{a.shotType || '-'}</td>
                      <td className="py-2 px-3">{typeof a.score === 'number' ? a.score : '-'}</td>
                      <td className="py-2 px-3">{a.status || '-'}</td>
                      <td className="py-2 px-3">{typeof a.createdAt === 'string' ? a.createdAt : (a?.createdAt?.toDate?.() ? a.createdAt.toDate().toISOString() : (typeof a?.createdAt?._seconds === 'number' ? new Date(a.createdAt._seconds * 1000 + Math.round((a.createdAt._nanoseconds||0)/1e6)).toISOString() : '-'))}</td>
                    </tr>
                  ))}
                  {!(latestAnalyses || []).length && (
                    <tr><td className="py-3 px-3 text-muted-foreground" colSpan={5}>Sin análisis recientes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pagos recientes</CardTitle>
                <CardDescription>Últimos pagos de este usuario</CardDescription>
              </div>
              <Link href="/admin?tab=payments" className="text-sm underline">Ver todos</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded border overflow-x-auto">
              <table className="min-w-[600px] text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-2 px-3">ID</th>
                    <th className="py-2 px-3">Producto</th>
                    <th className="py-2 px-3">Estado</th>
                    <th className="py-2 px-3">Importe</th>
                    <th className="py-2 px-3">Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {(latestPayments || []).map((p: any) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-2 px-3">{p.id}</td>
                      <td className="py-2 px-3">{p.productId || '-'}</td>
                      <td className="py-2 px-3">{p.status || '-'}</td>
                      <td className="py-2 px-3">{typeof p.amount === 'number' ? `${p.amount.toLocaleString('es-AR')} ${p.currency || ''}` : '-'}</td>
                      <td className="py-2 px-3">{typeof p.createdAt === 'string' ? p.createdAt : (p?.createdAt?.toDate?.() ? p.createdAt.toDate().toISOString() : (typeof p?.createdAt?._seconds === 'number' ? new Date(p.createdAt._seconds * 1000 + Math.round((p.createdAt._nanoseconds||0)/1e6)).toISOString() : '-'))}</td>
                    </tr>
                  ))}
                  {!(latestPayments || []).length && (
                    <tr><td className="py-3 px-3 text-muted-foreground" colSpan={5}>Sin pagos recientes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tickets recientes</CardTitle>
                <CardDescription>Últimos tickets de soporte del usuario</CardDescription>
              </div>
              <Link href="/admin/tickets" className="text-sm underline">Ver todos</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded border overflow-x-auto">
              <table className="min-w-[800px] text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-2 px-3">ID</th>
                    <th className="py-2 px-3">Asunto</th>
                    <th className="py-2 px-3">Estado</th>
                    <th className="py-2 px-3">Prioridad</th>
                    <th className="py-2 px-3">Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {(latestTickets || []).map((t: any) => (
                    <tr key={t.id} className="border-t">
                      <td className="py-2 px-3"><Link href={`/admin/tickets/${t.id}`} className="underline">{t.id}</Link></td>
                      <td className="py-2 px-3">{t.subject || '-'}</td>
                      <td className="py-2 px-3">{t.status || '-'}</td>
                      <td className="py-2 px-3">{t.priority || '-'}</td>
                      <td className="py-2 px-3">{typeof t.updatedAt === 'string' ? t.updatedAt : (t?.updatedAt?.toDate?.() ? t.updatedAt.toDate().toISOString() : (typeof t?.updatedAt?._seconds === 'number' ? new Date(t.updatedAt._seconds * 1000 + Math.round((t.updatedAt._nanoseconds||0)/1e6)).toISOString() : '-'))}</td>
                    </tr>
                  ))}
                  {!(latestTickets || []).length && (
                    <tr><td className="py-3 px-3 text-muted-foreground" colSpan={5}>Sin tickets recientes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


