import { adminDb } from "@/lib/firebase-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { adminUpdateCoachStatus, adminUpdateCoachProfile, adminSendPasswordReset, adminActivateCoachNow, adminUpdateCoachPhoto, adminActivateCoachAndSendPassword } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { CoachPhotoUpload } from "@/components/admin/coach-photo-upload";

export const dynamic = 'force-dynamic';

export async function actionUpdateCoachStatus(formData: FormData) { 'use server'; return await (adminUpdateCoachStatus as any)(undefined, formData); }
export async function actionUpdateCoachProfile(formData: FormData) { 'use server'; return await (adminUpdateCoachProfile as any)(undefined, formData); }
export async function actionSendPasswordReset(formData: FormData) { 'use server'; return await (adminSendPasswordReset as any)(undefined, formData); }
export async function actionActivateCoachNow(formData: FormData) { 'use server'; return await (adminActivateCoachNow as any)(undefined, formData); }
export async function actionUpdateCoachPhoto(formData: FormData) { 'use server'; return await (adminUpdateCoachPhoto as any)(undefined, formData); }
export async function actionActivateAndInvite(formData: FormData) { 'use server'; return await (adminActivateCoachAndSendPassword as any)(undefined, formData); }

async function getCoachData(userId: string) {
  if (!adminDb) return null;
  const coachSnap = await adminDb.collection('coaches').doc(userId).get();
  if (!coachSnap.exists) return null;
  const playersSnap = await adminDb.collection('players').where('coachId', '==', userId).limit(10).get();
  const analysesSnap = await adminDb.collection('analyses').where('coachId', '==', userId).orderBy('createdAt','desc').limit(10).get();
  const paymentsSnap = await adminDb.collection('payments').where('coachId', '==', userId).orderBy('createdAt','desc').limit(10).get();
  return {
    id: userId,
    coach: coachSnap.data(),
    playersCount: playersSnap.size,
    latestAnalyses: analysesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })),
    latestPayments: paymentsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })),
  };
}

export default async function AdminCoachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCoachData(id);
  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Entrenador no encontrado.</p>
        <Link href="/admin?tab=coaches" className="underline">Volver</Link>
      </div>
    );
  }

  const { coach, playersCount, latestAnalyses, latestPayments } = data as any;
  const statusVariant = coach.status === 'active' ? 'default' : coach.status === 'pending' ? 'secondary' : 'destructive';
  const photoVersion = coach?.updatedAt
    ? (typeof coach.updatedAt === 'string'
      ? coach.updatedAt
      : (coach?.updatedAt?.toDate?.()
        ? coach.updatedAt.toDate().toISOString()
        : (typeof coach?.updatedAt?._seconds === 'number'
          ? new Date(coach.updatedAt._seconds * 1000 + Math.round((coach.updatedAt._nanoseconds || 0) / 1e6)).toISOString()
          : '')))
    : '';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold">{coach.name || 'Entrenador'}</h1>
          <p className="text-muted-foreground">{coach.email}</p>
        </div>
        <Badge variant={statusVariant as any} className="capitalize">{coach.status || 'pending'}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Métricas</CardTitle>
            <CardDescription>Resumen del entrenador</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Jugadores asociados</div>
              <div className="text-2xl font-semibold">{playersCount}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Últimos análisis</div>
              <div className="text-2xl font-semibold">{latestAnalyses?.length || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Últimos pagos</div>
              <div className="text-2xl font-semibold">{latestPayments?.length || 0}</div>
            </div>

            <div className="col-span-2">
              <div className="text-sm font-medium mb-2">Análisis recientes</div>
              <div className="rounded border overflow-x-auto">
                <table className="min-w-[700px] text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="py-2 px-3">ID</th>
                      <th className="py-2 px-3">Jugador</th>
                      <th className="py-2 px-3">Tipo</th>
                      <th className="py-2 px-3">Estado</th>
                      <th className="py-2 px-3">Creado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(latestAnalyses || []).map((a: any) => (
                      <tr key={a.id} className="border-t">
                        <td className="py-2 px-3">{a.id}</td>
                        <td className="py-2 px-3">{a.playerId || '-'}</td>
                        <td className="py-2 px-3">{a.shotType || '-'}</td>
                        <td className="py-2 px-3">{a.status || '-'}</td>
                        <td className="py-2 px-3">{typeof a.createdAt === 'string' ? a.createdAt : (a?.createdAt?.toDate?.() ? a.createdAt.toDate().toISOString() : (typeof a?.createdAt?._seconds === 'number' ? new Date(a.createdAt._seconds * 1000 + Math.round((a.createdAt._nanoseconds||0)/1e6)).toISOString() : '-'))}</td>
                      </tr>
                    ))}
                    {!(latestAnalyses || []).length && (
                      <tr><td className="py-3 px-3 text-muted-foreground" colSpan={5}>Sin registros recientes</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="col-span-2">
              <div className="text-sm font-medium mb-2">Pagos recientes</div>
              <div className="rounded border overflow-x-auto">
                <table className="min-w-[700px] text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="py-2 px-3">ID</th>
                      <th className="py-2 px-3">Usuario</th>
                      <th className="py-2 px-3">Producto</th>
                      <th className="py-2 px-3">Estado</th>
                      <th className="py-2 px-3">Creado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(latestPayments || []).map((p: any) => (
                      <tr key={p.id} className="border-t">
                        <td className="py-2 px-3">{p.id}</td>
                        <td className="py-2 px-3">{p.userId || '-'}</td>
                        <td className="py-2 px-3">{p.productId || '-'}</td>
                        <td className="py-2 px-3">{p.status || '-'}</td>
                        <td className="py-2 px-3">{typeof p.createdAt === 'string' ? p.createdAt : (p?.createdAt?.toDate?.() ? p.createdAt.toDate().toISOString() : (typeof p?.createdAt?._seconds === 'number' ? new Date(p.createdAt._seconds * 1000 + Math.round((p.createdAt._nanoseconds||0)/1e6)).toISOString() : '-'))}</td>
                      </tr>
                    ))}
                    {!(latestPayments || []).length && (
                      <tr><td className="py-3 px-3 text-muted-foreground" colSpan={5}>Sin registros recientes</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
            <CardDescription>Administrar estado y perfil</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">Foto de perfil</div>
              <CoachPhotoUpload
                userId={data.id}
                photoUrl={coach?.photoUrl || ''}
                photoVersion={photoVersion}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <form action={actionActivateAndInvite}>
                <input type="hidden" name="userId" value={data.id} />
                <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700">Dar alta + enviar contraseña</Button>
              </form>
              <div className="text-xs text-muted-foreground">Activa y envía email de contraseña</div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <form action={actionActivateCoachNow}>
                <input type="hidden" name="userId" value={data.id} />
                <Button type="submit" size="sm">Activar ya</Button>
              </form>
              <div className="text-xs text-muted-foreground">Setea status=active, verified y visible</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Estado de la cuenta</div>
              <form action={actionUpdateCoachStatus} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={data.id} />
                <select name="status" defaultValue={coach.status || 'pending'} className="border rounded px-2 py-1">
                  <option value="active">Activo</option>
                  <option value="pending">Pendiente</option>
                  <option value="suspended">Suspendido</option>
                </select>
                <Button type="submit" size="sm">Guardar</Button>
              </form>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Perfil</div>
              <form action={actionUpdateCoachProfile} className="grid grid-cols-2 gap-2">
                <input type="hidden" name="userId" value={data.id} />
                <label className="text-sm text-muted-foreground">Nombre</label>
                <input name="name" defaultValue={coach?.name || ''} className="border rounded px-2 py-1" />
                <label className="text-sm text-muted-foreground">Bio</label>
                <textarea name="bio" defaultValue={coach?.bio || ''} className="border rounded px-2 py-1 col-span-1" />
                <label className="text-sm text-muted-foreground">Tarifa por análisis</label>
                <input name="ratePerAnalysis" type="number" step="1" defaultValue={typeof coach?.ratePerAnalysis === 'number' ? coach.ratePerAnalysis : ''} className="border rounded px-2 py-1" />
                <label className="text-sm text-muted-foreground">Email de pagos</label>
                <input name="payoutEmail" type="email" defaultValue={coach?.payoutEmail || ''} className="border rounded px-2 py-1" />
                <label className="text-sm text-muted-foreground">Verificado</label>
                <input name="verified" type="checkbox" defaultChecked={!!coach?.verified} />
                <label className="text-sm text-muted-foreground">Visible públicamente</label>
                <input name="publicVisible" type="checkbox" defaultChecked={!!coach?.publicVisible} />
                <label className="text-sm text-muted-foreground">Teléfono</label>
                <input name="phone" defaultValue={coach?.phone || ''} className="border rounded px-2 py-1" />
                <label className="text-sm text-muted-foreground">Sitio web</label>
                <input name="website" defaultValue={coach?.links?.website || ''} className="border rounded px-2 py-1" />
                <label className="text-sm text-muted-foreground">Twitter</label>
                <input name="twitter" defaultValue={coach?.links?.twitter || ''} className="border rounded px-2 py-1" />
                <label className="text-sm text-muted-foreground">Instagram</label>
                <input name="instagram" defaultValue={coach?.links?.instagram || ''} className="border rounded px-2 py-1" />
                <label className="text-sm text-muted-foreground">YouTube</label>
                <input name="youtube" defaultValue={coach?.links?.youtube || ''} className="border rounded px-2 py-1" />
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

            <Link href="/admin?tab=coaches" className="inline-block underline">Volver al listado</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


