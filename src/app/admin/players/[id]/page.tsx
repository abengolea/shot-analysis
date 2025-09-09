import { adminDb } from "@/lib/firebase-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { adminUpdatePlayerStatus, adminUpdateWallet, adminSetHistoryPlus, adminSendPasswordReset, giftAnalyses } from "@/app/actions";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

async function getPlayerData(userId: string) {
  if (!adminDb) return null;
  const playerSnap = await adminDb.collection('players').doc(userId).get();
  if (!playerSnap.exists) return null;
  const walletSnap = await adminDb.collection('wallets').doc(userId).get();
  const analysesSnap = await adminDb.collection('analyses').where('playerId', '==', userId).get();
  return {
    id: userId,
    player: playerSnap.data(),
    wallet: walletSnap.exists ? walletSnap.data() : null,
    analysesCount: analysesSnap.size,
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

  const { player, wallet, analysesCount } = data as any;

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
              <form action={adminUpdatePlayerStatus} className="flex items-center gap-2">
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
              <form method="post" action="/api/admin/update-wallet" className="grid grid-cols-2 gap-2">
                <input type="hidden" name="userId" defaultValue={data.id} />
                <input type="hidden" name="redirectTo" defaultValue={`/admin/players/${data.id}`} />
                <label className="text-sm text-muted-foreground">Créditos</label>
                <input name="credits" type="number" defaultValue={wallet?.credits ?? 0} className="border rounded px-2 py-1" />
                <label className="text-sm text-muted-foreground">Gratis usados</label>
                <input name="freeAnalysesUsed" type="number" defaultValue={wallet?.freeAnalysesUsed ?? 0} className="border rounded px-2 py-1" />
                <div className="col-span-2 flex justify-end">
                  <Button type="submit" size="sm">Guardar</Button>
                </div>
              </form>
              <div className="flex items-center gap-2">
                <form action={giftAnalyses}>
                  <input type="hidden" name="userId" value={data.id} />
                  <input type="hidden" name="count" value={1} />
                  <Button type="submit" variant="outline" size="sm">Regalar 1</Button>
                </form>
                <form action={giftAnalyses}>
                  <input type="hidden" name="userId" value={data.id} />
                  <input type="hidden" name="count" value={3} />
                  <Button type="submit" variant="outline" size="sm">Regalar 3</Button>
                </form>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">History+</div>
              <form action={adminSetHistoryPlus} className="grid grid-cols-2 gap-2 items-center">
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
              <form action={adminSendPasswordReset} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={data.id} />
                <Button type="submit" variant="outline" size="sm">Enviar reset de contraseña</Button>
              </form>
            </div>

            <Link href="/admin?tab=players" className="inline-block underline">Volver al listado</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


