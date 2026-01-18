"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { 
  Star, 
  Award, 
  Briefcase, 
  DollarSign, 
  MessageSquare, 
  Search, 
  Filter,
  MapPin,
  Users,
  Trophy,
  GraduationCap
} from "lucide-react";
import { db } from "@/lib/firebase";
import { addDoc, collection, onSnapshot, serverTimestamp } from "firebase/firestore";
import type { Coach } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { Message } from "@/lib/types";

export default function CoachesPage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("rating");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [helpOpenFor, setHelpOpenFor] = useState<Coach | null>(null);
  const [helpMessage, setHelpMessage] = useState<string>("Entrenador, me gustaría que analices mis tiros. ¿Podés ayudarme?");
  const [sending, setSending] = useState<boolean>(false);
  const [analysisIdFromQuery, setAnalysisIdFromQuery] = useState<string | null>(null);
  const [unlockCoach, setUnlockCoach] = useState<Coach | null>(null);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [creatingUnlock, setCreatingUnlock] = useState(false);
  const [usingFreeReview, setUsingFreeReview] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<'mercadopago' | 'dlocal'>('mercadopago');
  const [freeCoachReviews, setFreeCoachReviews] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setAnalysisIdFromQuery(params.get("analysisId"));
  }, []);

  useEffect(() => {
    try {
      const colRef = collection(db as any, 'coaches');
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const data = d.data() as any;
          const rawRate = data.ratePerAnalysis;
          const parsedRate = typeof rawRate === "number"
            ? rawRate
            : typeof rawRate === "string"
              ? Number(rawRate.replace(/[^0-9.-]/g, ""))
              : undefined;
          const rawShowRate = data.showRate;
          const parsedShowRate = typeof rawShowRate === "boolean"
            ? rawShowRate
            : typeof rawShowRate === "string"
              ? rawShowRate.toLowerCase() === "true"
              : rawShowRate;
          return {
            id: d.id,
            ...data,
            ratePerAnalysis: Number.isFinite(parsedRate) ? parsedRate : undefined,
            showRate: parsedShowRate,
          } as Coach;
        });
        setCoaches(list);
        setLoading(false);
      }, (err) => {
        console.error('Error cargando entrenadores:', err);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error('Error inicializando carga de entrenadores:', e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setFreeCoachReviews(0);
      return;
    }
    let cancelled = false;
    const fetchWallet = async () => {
      try {
        const res = await fetch(`/api/wallet?userId=${user.uid}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setFreeCoachReviews(Number(data?.freeCoachReviews || 0));
        }
      } catch {
        if (!cancelled) setFreeCoachReviews(0);
      }
    };
    fetchWallet();
    return () => { cancelled = true; };
  }, [user]);

  // Get unique specialties for filter
  const specialties = useMemo(() => {
    const allSpecialties = coaches.flatMap(coach => coach.specialties || []);
    return [...new Set(allSpecialties)];
  }, [coaches]);

  const availableCoachesCount = useMemo(() => {
    return coaches.filter(coach => coach.status !== 'suspended').length;
  }, [coaches]);

  // Búsqueda básica y ordenamiento (sin filtrar por precio/rating)
  const filteredCoaches = useMemo(() => {
    let filtered = coaches.filter(coach => {
      if (coach.status === 'suspended') return false;
      const matchesSearch = coach.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        coach.bio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        coach.specialties?.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesSpecialty = selectedSpecialty === 'all' || coach.specialties?.includes(selectedSpecialty);
      return matchesSearch && matchesSpecialty;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return (b.rating || 0) - (a.rating || 0);
        case "reviews":
          return (b.reviews || 0) - (a.reviews || 0);
        case "price":
          return (a.ratePerAnalysis || 0) - (b.ratePerAnalysis || 0);
        case "experience":
          return (b.yearsOfExperience || 0) - (a.yearsOfExperience || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [coaches, searchTerm, selectedSpecialty, sortBy]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating)
            ? "fill-yellow-400 text-yellow-500"
            : i < rating
            ? "fill-yellow-400/50 text-yellow-500"
            : "text-gray-300"
        }`}
      />
    ));
  };

  const openPaymentDialog = (coach: Coach) => {
    setUnlockError(null);
    setUnlockCoach(coach);
    setPaymentProvider("mercadopago");
    setUnlockDialogOpen(true);
  };

  const handleCreateUnlock = async () => {
    if (!unlockCoach) return;
    if (!analysisIdFromQuery) {
      setUnlockError("Para pagar una revisión necesitás abrir esta pantalla desde un análisis.");
      return;
    }
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      setCreatingUnlock(true);
      setUnlockError(null);
      const token = await user.getIdToken();
      const res = await fetch("/api/coach-unlocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisId: analysisIdFromQuery,
          coachId: unlockCoach.id,
          paymentProvider,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && data?.code === "AMOUNT_TOO_LOW") {
          setUnlockError(data?.error || "El monto es demasiado bajo para tarjeta. Usá MercadoPago.");
          toast({
            title: "Monto mínimo requerido",
            description: data?.error || "El monto es demasiado bajo para tarjeta. Usá MercadoPago.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(data?.error || "No se pudo iniciar el pago.");
      }
      const redirectUrl = data?.initPoint ||
        data?.sandboxInitPoint ||
        data?.checkoutUrl ||
        data?.redirectUrl ||
        data?.init_point ||
        data?.sandbox_init_point ||
        data?.checkout_url;
      if (redirectUrl && typeof redirectUrl === "string") {
        window.location.href = redirectUrl;
      } else {
        toast({
          title: "Solicitud creada",
          description: "Te avisaremos cuando el pago se confirme.",
        });
        setUnlockDialogOpen(false);
      }
    } catch (error: any) {
      setUnlockError(error?.message || "Error inesperado al iniciar el pago.");
    } finally {
      setCreatingUnlock(false);
    }
  };

  const handleUseFreeReview = async () => {
    if (!unlockCoach) return;
    if (!analysisIdFromQuery) {
      setUnlockError("Para usar una revisión gratis necesitás abrir esta pantalla desde un análisis.");
      return;
    }
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      setUsingFreeReview(true);
      setUnlockError(null);
      const token = await user.getIdToken();
      const res = await fetch("/api/coach-unlocks/free", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisId: analysisIdFromQuery,
          coachId: unlockCoach.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo usar la revisión gratis.");
      }
      setFreeCoachReviews(Number(data?.freeCoachReviewsLeft ?? Math.max(0, freeCoachReviews - 1)));
      toast({
        title: "Revisión gratis aplicada",
        description: "El entrenador ya tiene acceso al análisis.",
      });
      setUnlockDialogOpen(false);
      router.refresh();
    } catch (error: any) {
      setUnlockError(error?.message || "Error inesperado al usar revisión gratis.");
    } finally {
      setUsingFreeReview(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          Encuentra tu Entrenador
        </h1>
        <p className="mt-2 text-muted-foreground">
          Conecta con entrenadores profesionales para obtener feedback personalizado.
        </p>
        <div className="mt-4">
          <Link href="/coach-register" className="text-primary underline">
            ¿Eres entrenador? Crea tu perfil aquí
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-6">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar entrenadores por nombre, especialidad o experiencia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros:</span>
          </div>

          {/* Specialty Filter */}
          <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Especialidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las especialidades</SelectItem>
              {specialties.map((specialty) => (
                <SelectItem key={specialty} value={specialty}>
                  {specialty}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sin filtros de precio ni rating */}

          {/* Sort By */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">Mejor Rating</SelectItem>
              <SelectItem value="reviews">Más Reseñas</SelectItem>
              <SelectItem value="price">Precio más bajo</SelectItem>
              <SelectItem value="experience">Más Experiencia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          Mostrando {filteredCoaches.length} de {availableCoachesCount} entrenadores
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 text-muted-foreground">Cargando entrenadores...</div>
      )}

      {/* Coaches Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCoaches.map((coach) => (
          <Card key={coach.id} className="flex flex-col hover:shadow-lg transition-shadow">
            <CardHeader className="items-center text-center pb-4">
              <Avatar className="h-24 w-24 border-4 border-primary/20">
                <AvatarImage src={coach.avatarUrl} alt={coach.name} />
                <AvatarFallback>{coach.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <CardTitle className="font-headline pt-2 text-2xl">{coach.name}</CardTitle>
              
              {/* Rating and Reviews */}
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  {renderStars(coach.rating || 0)}
                </div>
                <span className="text-sm font-semibold text-primary">
                  {coach.rating?.toFixed(1)}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mb-3">
                ({coach.reviews} reseñas)
              </div>

              {/* Specialties */}
              <div className="flex flex-wrap gap-1 justify-center">
                {coach.specialties?.slice(0, 3).map((specialty) => (
                  <Badge key={specialty} variant="secondary" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
              </div>
            </CardHeader>

            <CardContent className="flex-grow space-y-4">
              {/* Experience */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" /> 
                  Experiencia
                </h4>
                <p className="text-sm text-muted-foreground">
                  {coach.bio || coach.experience}
                </p>
              </div>

              {/* Certifications */}
              {coach.certifications && coach.certifications.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    Certificaciones
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {coach.certifications.slice(0, 2).map((cert) => (
                      <Badge key={cert} variant="outline" className="text-xs">
                        {cert}
                      </Badge>
                    ))}
                    {coach.certifications.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{coach.certifications.length - 2} más
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Education */}
              {coach.education && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Educación
                  </h4>
                  <p className="text-sm text-muted-foreground">{coach.education}</p>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col items-stretch gap-3 pt-4">
              {/* Tarifa: visible solo si showRate !== false y existe ratePerAnalysis */}
              {(coach.showRate !== false && typeof coach.ratePerAnalysis === "number") && (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex justify-center items-baseline">
                    <span className="font-headline text-3xl font-bold text-primary">
                      ${coach.ratePerAnalysis.toLocaleString("es-AR")}
                    </span>
                    <span className="text-sm text-muted-foreground">/análisis</span>
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    + 30% costo de servicio
                  </div>
                  <div className="text-sm font-semibold text-primary text-center">
                    Total: ${(coach.ratePerAnalysis + Math.max(1, Math.round(coach.ratePerAnalysis * 0.3))).toLocaleString("es-AR")}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Dialog open={helpOpenFor?.id === coach.id} onOpenChange={(open) => setHelpOpenFor(open ? coach : null)}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Pedir ayuda
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Pedir ayuda a {coach.name}</DialogTitle>
                      <DialogDescription>Envía un mensaje breve al entrenador.</DialogDescription>
                    </DialogHeader>
                    <Textarea
                      value={helpMessage}
                      onChange={(e) => setHelpMessage(e.target.value)}
                      rows={4}
                    />
                    <DialogFooter>
                      <Button
                        disabled={sending || !user}
                        onClick={async () => {
                          if (!user) {
                            window.location.href = '/login';
                            return;
                          }
                          try {
                            setSending(true);
                            const colRef = collection(db as any, 'messages');
                            const payload = {
                              fromId: user.uid,
                              fromName: (userProfile as any)?.name || user.displayName || 'Jugador',
                              fromAvatarUrl: (userProfile as any)?.avatarUrl || '',
                              toId: coach.id,
                              toCoachDocId: coach.id,
                              toName: coach.name,
                              text: helpMessage,
                              createdAt: serverTimestamp(),
                              read: false,
                            };
                            await addDoc(colRef, payload as any);
                            setHelpOpenFor(null);
                          } catch (e) {
                            console.error('Error enviando mensaje:', e);
                          } finally {
                            setSending(false);
                          }
                        }}
                      >
                        {sending ? 'Enviando…' : 'Enviar mensaje'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button
                  className="flex-1"
                  onClick={() => {
                    openPaymentDialog(coach);
                  }}
                >
                  <Users className="mr-2 h-4 w-4" /> 
                  Pedir análisis de entrenador
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* No Results */}
      {filteredCoaches.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            <Search className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No se encontraron entrenadores</h3>
            <p>Intenta ajustar los filtros o términos de búsqueda</p>
          </div>
        </div>
      )}

      <Dialog
        open={unlockDialogOpen}
        onOpenChange={(open) => {
          setUnlockDialogOpen(open);
          if (!open) {
            setUnlockCoach(null);
            setUnlockError(null);
            setPaymentProvider("mercadopago");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {unlockCoach ? `Conectar con ${unlockCoach.name}` : "Conectar con entrenador"}
            </DialogTitle>
            <DialogDescription>
              Elegí el método de pago para solicitar la revisión del entrenador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!analysisIdFromQuery && (
              <div className="text-sm text-destructive">
                Para solicitar una revisión entrá desde el botón de un análisis en tu panel.
              </div>
            )}
            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="mb-2">
                <p className="text-xs text-muted-foreground mb-2">
                  El precio mostrado incluye la tarifa del entrenador más un 30% adicional por costo de servicio de la plataforma.
                </p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-words">Tarifa del entrenador</span>
                <span className="font-semibold flex-shrink-0 whitespace-nowrap">
                  {typeof unlockCoach?.ratePerAnalysis === "number"
                    ? `$${unlockCoach.ratePerAnalysis.toLocaleString("es-AR")}`
                    : "No disponible"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span className="min-w-0 break-words">Costo de servicio de la plataforma (30%)</span>
                <span className="flex-shrink-0 whitespace-nowrap">
                  {typeof unlockCoach?.ratePerAnalysis === "number"
                    ? `$${Math.max(1, Math.round(unlockCoach.ratePerAnalysis * 0.3)).toLocaleString("es-AR")}`
                    : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t font-semibold text-lg">
                <span className="min-w-0 break-words">Total a pagar</span>
                <span className="flex-shrink-0 whitespace-nowrap text-primary">
                  {typeof unlockCoach?.ratePerAnalysis === "number"
                    ? `$${(unlockCoach.ratePerAnalysis + Math.max(1, Math.round(unlockCoach.ratePerAnalysis * 0.3))).toLocaleString("es-AR")}`
                    : "-"}
                </span>
              </div>
            </div>

            {freeCoachReviews > 0 && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="font-medium">Tenés {freeCoachReviews} revisión{freeCoachReviews === 1 ? "" : "es"} gratis disponible{freeCoachReviews === 1 ? "" : "s"}.</p>
                <p className="text-emerald-800 text-xs mt-1">
                  Podés usar una revisión gratis para desbloquear este entrenador sin pagar.
                </p>
              </div>
            )}

            <div className="rounded-md border p-3 text-sm space-y-2 bg-blue-50 border-blue-200">
              <label className="font-medium">Método de pago</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={paymentProvider === "mercadopago" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setPaymentProvider("mercadopago")}
                >
                  {paymentProvider === "mercadopago" && "✓ "}MercadoPago
                </Button>
                <Button
                  type="button"
                  variant={paymentProvider === "dlocal" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setPaymentProvider("dlocal")}
                >
                  {paymentProvider === "dlocal" && "✓ "}Tarjeta de crédito o débito
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Seleccionado: <strong>{paymentProvider === "mercadopago" ? "MercadoPago" : "Tarjeta de crédito o débito"}</strong>
              </p>
            </div>

            {unlockError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive break-words">
                {unlockError}
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setUnlockDialogOpen(false)}
              disabled={creatingUnlock || usingFreeReview}
            >
              Cancelar
            </Button>
            {freeCoachReviews > 0 && (
              <Button
                variant="secondary"
                onClick={handleUseFreeReview}
                disabled={
                  usingFreeReview ||
                  creatingUnlock ||
                  !analysisIdFromQuery ||
                  !unlockCoach
                }
              >
                {usingFreeReview ? "Usando revisión..." : "Usar revisión gratis"}
              </Button>
            )}
            <Button
              onClick={handleCreateUnlock}
              disabled={
                creatingUnlock ||
                usingFreeReview ||
                !analysisIdFromQuery ||
                !unlockCoach ||
                typeof unlockCoach?.ratePerAnalysis !== "number"
              }
            >
              {creatingUnlock ? "Abriendo pago..." : "Pagar y conectar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
