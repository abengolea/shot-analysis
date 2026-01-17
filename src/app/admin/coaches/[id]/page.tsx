import { adminDb } from "@/lib/firebase-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { adminUpdateCoachStatus, adminUpdateCoachProfile, adminSendPasswordReset, adminActivateCoachNow, adminUpdateCoachPhoto, adminActivateCoachAndSendPassword, adminToggleCoachHidden } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CoachInviteActions } from "@/components/admin/coach-invite-actions";

export const dynamic = 'force-dynamic';

export async function actionUpdateCoachStatus(formData: FormData) { 'use server'; return await (adminUpdateCoachStatus as any)(undefined, formData); }
export async function actionUpdateCoachProfile(formData: FormData) { 'use server'; return await (adminUpdateCoachProfile as any)(undefined, formData); }
export async function actionSendPasswordReset(formData: FormData) { 'use server'; return await (adminSendPasswordReset as any)(undefined, formData); }
export async function actionActivateCoachNow(formData: FormData) { 'use server'; return await (adminActivateCoachNow as any)(undefined, formData); }
export async function actionUpdateCoachPhoto(formData: FormData) { 'use server'; return await (adminUpdateCoachPhoto as any)(undefined, formData); }
export async function actionActivateAndInvite(_prev: any, formData: FormData) { 'use server'; return await (adminActivateCoachAndSendPassword as any)(_prev, formData); }
export async function actionToggleCoachHidden(formData: FormData) { 'use server'; return await (adminToggleCoachHidden as any)(undefined, formData); }

async function getCoachData(userId: string) {
  if (!adminDb) return null;
  const coachSnap = await adminDb.collection('coaches').doc(userId).get();
  if (!coachSnap.exists) return null;
  const playersSnap = await adminDb.collection('players').where('coachId', '==', userId).limit(10).get();
  const analysesSnap = await adminDb.collection('analyses').where('coachId', '==', userId).orderBy('createdAt','desc').limit(10).get();
  const paymentsSnap = await adminDb.collection('payments').where('coachId', '==', userId).orderBy('createdAt','desc').limit(10).get();

  const relatedPlayerIds = new Set<string>();
  analysesSnap.docs.forEach(doc => {
    const playerId = (doc.data() as any)?.playerId;
    if (playerId) relatedPlayerIds.add(String(playerId));
  });
  paymentsSnap.docs.forEach(doc => {
    const userId = (doc.data() as any)?.userId;
    if (userId) relatedPlayerIds.add(String(userId));
  });

  const playerNames: Record<string, string> = {};
  await Promise.all(Array.from(relatedPlayerIds).map(async (id) => {
    try {
      const snap = await adminDb!.collection('players').doc(id).get();
      if (snap.exists) {
        const data = snap.data() as any;
        playerNames[id] = data?.name || data?.displayName || id;
      }
    } catch {
      // ignore
    }
  }));

  return {
    id: userId,
    coach: coachSnap.data(),
    playersCount: playersSnap.size,
    latestAnalyses: analysesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })),
    latestPayments: paymentsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })),
    playerNames,
  };
}

function getAnalysisStatus(status?: string) {
  if (!status) return { label: 'Pendiente', variant: 'secondary' as const };
  const normalized = status.toLowerCase();
  if (['analyzed', 'done', 'completed'].includes(normalized)) {
    return { label: 'Terminado', variant: 'default' as const };
  }
  if (['processing', 'in_progress'].includes(normalized)) {
    return { label: 'En proceso', variant: 'secondary' as const };
  }
  if (['error', 'cancelled', 'failed'].includes(normalized)) {
    return { label: 'Error', variant: 'destructive' as const };
  }
  return { label: 'Pendiente', variant: 'secondary' as const };
}

export default async function AdminCoachDetailPage({ params }: { params: { id: string } }) {
  const data = await getCoachData(params.id);
  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Entrenador no encontrado.</p>
        <Link href="/admin?tab=coaches" className="underline">Volver</Link>
      </div>
    );
  }

  const { coach, playersCount, latestAnalyses, latestPayments, playerNames } = data as any;
  const statusVariant = coach.status === 'active' ? 'default' : coach.status === 'pending' ? 'secondary' : 'destructive';
  const isHidden = coach.hidden === true;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white/70 p-4 shadow-sm">
        <div>
          <p className="text-sm text-muted-foreground">Entrenador</p>
          <h1 className="font-headline text-3xl font-bold">{coach.name || 'Entrenador'}</h1>
          <p className="text-muted-foreground">{coach.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {isHidden && (
            <Badge variant="secondary" className="text-base px-4 py-1">Oculto</Badge>
          )}
          <Badge variant={statusVariant as any} className="capitalize text-base px-4 py-1">{coach.status || 'pending'}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle>Métricas</CardTitle>
              <CardDescription>Resumen del entrenador</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: 'Jugadores asociados', value: playersCount },
                  { label: 'Últimos análisis', value: latestAnalyses?.length || 0 },
                  { label: 'Últimos pagos', value: latestPayments?.length || 0 },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-xl border bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                    <p className="mt-1 text-2xl font-semibold">{metric.value}</p>
                  </div>
                ))}
              </div>

              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Análisis recientes</h3>
                  <p className="text-xs text-muted-foreground">Últimos 10 registros</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin?tab=players`} prefetch={false}>Ver jugadores</Link>
                  </Button>
                  {latestAnalyses?.length ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/analysis/${latestAnalyses[0].id}`} prefetch={false}>Abrir último análisis</Link>
                    </Button>
                  ) : null}
                </div>
                <div className="rounded-xl border bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto text-sm">
                      <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
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
                            <td className="py-2 px-3 font-medium">
                              <Link href={`/analysis/${a.id}`} className="text-primary underline" prefetch={false}>
                                {a.id}
                              </Link>
                            </td>
                            <td className="py-2 px-3">
                              {a.playerId ? (
                                <Link href={`/admin/players/${a.playerId}`} className="underline" prefetch={false}>
                                  {playerNames?.[a.playerId] || a.playerName || a.playerId}
                                </Link>
                              ) : '-'}
                            </td>
                            <td className="py-2 px-3">{a.shotType || '-'}</td>
                            <td className="py-2 px-3">
                              <Badge variant={getAnalysisStatus(a.status).variant}>{getAnalysisStatus(a.status).label}</Badge>
                            </td>
                            <td className="py-2 px-3">{typeof a.createdAt === 'string' ? a.createdAt : (a?.createdAt?.toDate?.() ? a.createdAt.toDate().toISOString() : (typeof a?.createdAt?._seconds === 'number' ? new Date(a.createdAt._seconds * 1000 + Math.round((a.createdAt._nanoseconds||0)/1e6)).toISOString() : '-'))}</td>
                          </tr>
                        ))}
                        {!(latestAnalyses || []).length && (
                          <tr><td className="py-4 px-3 text-center text-muted-foreground" colSpan={5}>Sin registros recientes</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Pagos recientes</h3>
                  <p className="text-xs text-muted-foreground">Últimas transacciones asociadas</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/admin?tab=payments" prefetch={false}>Ir a pagos</Link>
                  </Button>
                </div>
                <div className="rounded-xl border bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto text-sm">
                      <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
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
                            <td className="py-2 px-3 font-medium">{p.id}</td>
                            <td className="py-2 px-3">
                              {p.userId ? (
                                <Link href={`/admin/players/${p.userId}`} className="underline" prefetch={false}>
                                  {playerNames?.[p.userId] || p.userId}
                                </Link>
                              ) : '-'}
                            </td>
                            <td className="py-2 px-3">{p.productId || '-'}</td>
                            <td className="py-2 px-3">{p.status || '-'}</td>
                            <td className="py-2 px-3">{typeof p.createdAt === 'string' ? p.createdAt : (p?.createdAt?.toDate?.() ? p.createdAt.toDate().toISOString() : (typeof p?.createdAt?._seconds === 'number' ? new Date(p.createdAt._seconds * 1000 + Math.round((p.createdAt._nanoseconds||0)/1e6)).toISOString() : '-'))}</td>
                          </tr>
                        ))}
                        {!(latestPayments || []).length && (
                          <tr><td className="py-4 px-3 text-center text-muted-foreground" colSpan={5}>Sin registros recientes</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Acciones rápidas</CardTitle>
              <CardDescription>Estado, foto y accesos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">Foto de perfil</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {coach?.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coach.photoUrl} alt="Foto" className="h-16 w-16 rounded-full object-cover border" />
                  ) : (
                    <div className="h-16 w-16 rounded-full border bg-white flex items-center justify-center text-xs text-muted-foreground">Sin foto</div>
                  )}
                  <form action={actionUpdateCoachPhoto} className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                    <input type="hidden" name="userId" value={data.id} />
                    <Input name="avatarFile" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
                    <Button type="submit" size="sm" className="shrink-0">Subir</Button>
                  </form>
                </div>
              </div>

              <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="font-medium text-muted-foreground">Activaciones</div>
                <div className="flex flex-wrap gap-2">
                  <CoachInviteActions userId={data.id} actionActivateAndInvite={actionActivateAndInvite} />
                  <form action={actionActivateCoachNow}>
                    <input type="hidden" name="userId" value={data.id} />
                    <Button type="submit" variant="outline" size="sm">Activar ya</Button>
                  </form>
                </div>
                <p className="text-xs text-muted-foreground">Usá el botón verde para invitar o el outline para solo activar.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Estado de la cuenta</Label>
                <form action={actionUpdateCoachStatus} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="userId" value={data.id} />
                  <select name="status" defaultValue={coach.status || 'pending'} className="w-full rounded-md border px-2 py-2 text-sm sm:w-auto">
                    <option value="active">Activo</option>
                    <option value="pending">Pendiente</option>
                    <option value="suspended">Suspendido</option>
                  </select>
                  <Button type="submit" size="sm">Guardar estado</Button>
                </form>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Visibilidad</Label>
                <form action={actionToggleCoachHidden} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="userId" value={data.id} />
                  <Button 
                    type="submit" 
                    size="sm" 
                    variant={isHidden ? "default" : "outline"}
                    className={isHidden ? "bg-orange-600 hover:bg-orange-700" : ""}
                  >
                    {isHidden ? "Mostrar" : "Ocultar"}
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground">
                  {isHidden 
                    ? "El entrenador está oculto y no aparece en la lista pública" 
                    : "Ocultar el entrenador de la lista pública sin borrarlo"}
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Perfil completo</p>
                  <p className="text-xs text-muted-foreground">Actualiza datos visibles en la app y en el marketplace.</p>
                </div>
                <form action={actionUpdateCoachProfile} className="grid gap-4">
                  <input type="hidden" name="userId" value={data.id} />

                  <div className="grid gap-2">
                    <Label>Nombre</Label>
                    <Input name="name" defaultValue={coach?.name || ''} />
                  </div>

                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input name="email" type="email" defaultValue={coach?.email || ''} />
                  </div>

                  <div className="grid gap-2">
                    <Label>Bio</Label>
                    <Textarea name="bio" defaultValue={coach?.bio || ''} rows={3} />
                  </div>

                  <div className="grid gap-2">
                    <Label>Experiencia (resumen)</Label>
                    <Textarea name="experience" defaultValue={coach?.experience || ''} rows={2} placeholder="Resumen breve de la experiencia profesional" />
                  </div>

                  <div className="grid gap-2">
                    <Label>Educación</Label>
                    <Input name="education" defaultValue={coach?.education || ''} placeholder="Ej: Profesor universitario de Educación Física" />
                  </div>

                  <div className="grid gap-2">
                    <Label>Años de experiencia</Label>
                    <Input name="yearsOfExperience" type="number" step="1" min="0" defaultValue={typeof coach?.yearsOfExperience === 'number' ? coach.yearsOfExperience : ''} />
                  </div>

                  <div className="grid gap-2">
                    <Label>Certificaciones (una por línea)</Label>
                    <Textarea 
                      name="certifications" 
                      rows={4} 
                      defaultValue={Array.isArray(coach?.certifications) ? coach.certifications.join('\n') : ''} 
                      placeholder="Entrenador de Básquet ENEBA nivel 3&#10;Autor del libro &quot;Reflexiones sobre Mini básquet&quot;"
                    />
                    <p className="text-xs text-muted-foreground">Escribe cada certificación en una línea separada</p>
                  </div>

                  <div className="grid gap-2">
                    <Label>Especialidades (una por línea)</Label>
                    <Textarea 
                      name="specialties" 
                      rows={3} 
                      defaultValue={Array.isArray(coach?.specialties) ? coach.specialties.join('\n') : ''} 
                      placeholder="Mini básquet&#10;Iniciación deportiva en niños&#10;Enseñanza del lanzamiento"
                    />
                    <p className="text-xs text-muted-foreground">Escribe cada especialidad en una línea separada</p>
                  </div>

                  <div className="grid gap-2">
                    <Label>Tarifa por análisis</Label>
                    <Input name="ratePerAnalysis" type="number" step="1" defaultValue={typeof coach?.ratePerAnalysis === 'number' ? coach.ratePerAnalysis : ''} />
                  </div>

                  <div className="grid gap-2">
                    <Label>Email de pagos</Label>
                    <Input name="payoutEmail" type="email" defaultValue={coach?.payoutEmail || ''} />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input name="verified" type="checkbox" defaultChecked={!!coach?.verified} className="h-4 w-4" />
                      Verificado
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input name="publicVisible" type="checkbox" defaultChecked={!!coach?.publicVisible} className="h-4 w-4" />
                      Visible públicamente
                    </label>
                  </div>

                  <div className="grid gap-2">
                    <Label>Teléfono</Label>
                    <Input name="phone" defaultValue={coach?.phone || ''} />
                  </div>

                  <div className="grid gap-2">
                    <Label>Sitio web</Label>
                    <Input name="website" defaultValue={coach?.links?.website || ''} />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Twitter</Label>
                      <Input name="twitter" defaultValue={coach?.links?.twitter || ''} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Instagram</Label>
                      <Input name="instagram" defaultValue={coach?.links?.instagram || ''} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label>YouTube</Label>
                      <Input name="youtube" defaultValue={coach?.links?.youtube || ''} />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" size="sm">Guardar cambios</Button>
                  </div>
                </form>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Seguridad</p>
                    <p className="text-xs text-muted-foreground">Envía un enlace para que el coach regenere su contraseña.</p>
                  </div>
                  <form action={actionSendPasswordReset}>
                    <input type="hidden" name="userId" value={data.id} />
                    <Button type="submit" variant="outline" size="sm">Enviar reset</Button>
                  </form>
                </div>
              </div>

              <div className="text-right">
                <Link href="/admin?tab=coaches" className="text-sm font-medium text-primary underline">Volver al listado</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

