"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { 
  Star, 
  Award, 
  Briefcase, 
  MessageSquare, 
  Search, 
  Filter,
  Clock,
  Users,
  Trophy,
  GraduationCap,
  Loader2
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import type { Message } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { getClientAppBaseUrl } from "@/lib/app-url";
import { buildConversationId, getMessageType } from "@/lib/message-utils";

export default function CoachesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("rating");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [helpOpenFor, setHelpOpenFor] = useState<Coach | null>(null);
  const [helpMessage, setHelpMessage] = useState<string>("Entrenador, me gustaría que analices mis tiros. ¿Podés ayudarme?");
  const [sending, setSending] = useState<boolean>(false);
  const [analysisIdFromQuery, setAnalysisIdFromQuery] = useState<string | null>(null);
  const [analysisInfo, setAnalysisInfo] = useState<any | null>(null);
  const [analysisInfoLoading, setAnalysisInfoLoading] = useState(false);
  const [analysisInfoError, setAnalysisInfoError] = useState<string | null>(null);
  const [unlockCoach, setUnlockCoach] = useState<Coach | null>(null);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [creatingUnlock, setCreatingUnlock] = useState(false);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [usingFreeReview, setUsingFreeReview] = useState(false);
  const [isAlreadyPaid, setIsAlreadyPaid] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<'mercadopago' | 'dlocal'>('mercadopago');
  const [paidCoachIds, setPaidCoachIds] = useState<string[]>([]);
  const [freeCoachReviews, setFreeCoachReviews] = useState<number>(0);
  const [reviewNoticeOpen, setReviewNoticeOpen] = useState(false);
  const [reviewNoticeCoachName, setReviewNoticeCoachName] = useState("");

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setAnalysisIdFromQuery(params.get('analysisId'));
  }, []);

  const getDisplayRate = useCallback((coach: Coach) => {
    if (typeof coach.ratePerAnalysis === 'number') return coach.ratePerAnalysis;
    const name = (coach.name || '').trim().toLowerCase();
    if (name === 'esteban daniel velasco') return 25000;
    return null;
  }, []);

  useEffect(() => {
    try {
      const colRef = collection(db as any, 'coaches');
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const data = d.data() as any;
          const rawRate = data.ratePerAnalysis;
          const parsedRate = typeof rawRate === 'number'
            ? rawRate
            : typeof rawRate === 'string'
              ? Number(rawRate.replace(/[^0-9.-]/g, ''))
              : undefined;
          const rawShowRate = data.showRate;
          const parsedShowRate = typeof rawShowRate === 'boolean'
            ? rawShowRate
            : typeof rawShowRate === 'string'
              ? rawShowRate.toLowerCase() === 'true'
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

  useEffect(() => {
    if (!analysisIdFromQuery) {
      setAnalysisInfo(null);
      setAnalysisInfoError(null);
      setPaidCoachIds([]);
      return;
    }
    let cancelled = false;
    const fetchAnalysis = async () => {
      try {
        setAnalysisInfoLoading(true);
        setAnalysisInfoError(null);
        if (!user) {
          throw new Error('Usuario no autenticado.');
        }
        const token = await user.getIdToken();
        const res = await fetch(`/api/analyses/${analysisIdFromQuery}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error('No pudimos encontrar ese análisis.');
        }
        const data = await res.json();
        if (!cancelled) {
          setAnalysisInfo(data);
          // Extraer IDs de coaches pagados para mostrar indicadores
          const coachAccess = data.coachAccess || {};
          const paidIds: string[] = [];
          for (const [coachId, access] of Object.entries(coachAccess)) {
            const accessData = access as any;
            if (accessData.status === 'paid') {
              paidIds.push(coachId);
            }
          }
          setPaidCoachIds(paidIds);
          // Si hay un coach seleccionado, verificar si ya está pagado
          if (unlockCoach && coachAccess[unlockCoach.id]) {
            const coachAccessData = coachAccess[unlockCoach.id] as any;
            if (coachAccessData.status === 'paid') {
              setIsAlreadyPaid(true);
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setAnalysisInfo(null);
          setAnalysisInfoError(e?.message || 'No se pudo cargar el análisis seleccionado.');
        }
      } finally {
        if (!cancelled) {
          setAnalysisInfoLoading(false);
        }
      }
    };
    fetchAnalysis();
    return () => {
      cancelled = true;
    };
  }, [analysisIdFromQuery, unlockCoach, user]);

  // Get unique specialties for filter
  const specialties = useMemo(() => {
    const allSpecialties = coaches.flatMap(coach => coach.specialties || []);
    return [...new Set(allSpecialties)];
  }, [coaches]);

  const visibleCoachesCount = useMemo(() => {
    return coaches.filter(coach => coach.hidden !== true && coach.status !== 'suspended').length;
  }, [coaches]);

  // Búsqueda básica y ordenamiento (sin filtrar por precio/rating)
  const filteredCoaches = useMemo(() => {
    let filtered = coaches.filter(coach => {
      if (coach.status === 'suspended') return false;
      // Filtrar coaches ocultos
      if (coach.hidden === true) return false;
      
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

  const coachRate = unlockCoach ? getDisplayRate(unlockCoach) : null;
  const platformFee = coachRate != null ? Math.max(1, Math.round(coachRate * 0.3)) : null;
  const totalAmount = coachRate != null && platformFee != null ? coachRate + platformFee : null;

  const formatAnalysisDate = (dateString?: string) => {
    if (!dateString) return 'fecha no disponible';
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const openReviewNotice = (coach?: Coach | null) => {
    const name = coach?.name?.trim();
    setReviewNoticeCoachName(name && name.length > 0 ? name : 'el entrenador');
    setReviewNoticeOpen(true);
  };

  const handleRequestReview = async (coach: Coach) => {
    if (!user) {
      router.push('/login');
      return;
    }
    console.log('🔘 handleRequestReview llamado, verificando estado de pago primero');
    setPaymentProvider('mercadopago'); // Reset al abrir
    setUnlockCoach(coach);
    setUnlockError(null);
    setIsAlreadyPaid(false);

    if (!analysisIdFromQuery) {
      setUnlockDialogOpen(true);
      return;
    }
    
    // Verificar si ya está pagado o tiene un pago pendiente ANTES de abrir el diálogo
    try {
      const token = await user.getIdToken();
      const unlockCheckRes = await fetch(`/api/analyses/${analysisIdFromQuery}/unlock-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (unlockCheckRes.ok) {
        const unlockData = await unlockCheckRes.json();
        const paidCoachIds = unlockData.paidCoachIds || [];
        const pendingCoachIds = unlockData.pendingCoachIds || [];
        const hasCoachFeedback = unlockData.hasCoachFeedback || false;
        
        // Verificar si este coach ya está en la lista de pagados o pendientes
        const isPaid = paidCoachIds.some((c: any) => c.coachId === coach.id);
        const isPending = pendingCoachIds.some((c: any) => c.coachId === coach.id);
        
        console.log('🔍 Estado del pago:', { isPaid, isPending, hasCoachFeedback, paidCoachIds, pendingCoachIds });
        
        if (isPaid) {
          console.log('✅ Coach ya tiene pago completado');
          setIsAlreadyPaid(true);
          if (hasCoachFeedback) {
            setUnlockError(null); // No mostrar error si ya tiene feedback
          } else {
            // No mostrar error, solo indicar que falta la evaluación
            setUnlockError(null);
          }
          openReviewNotice(coach);
          return;
        } else if (isPending) {
          console.log('⚠️ Coach tiene pago pendiente');
          setUnlockError('Ya tienes un pago pendiente para este entrenador. Espera a que se complete o contacta soporte si necesitas ayuda.');
          setIsAlreadyPaid(false);
        }
      }
    } catch (error) {
      console.error('Error verificando estado de unlock:', error);
      // Si falla la verificación, también verificar en analysisInfo como fallback
      if (analysisInfo) {
        const coachAccess = (analysisInfo.coachAccess || {})[coach.id];
        if (coachAccess && coachAccess.status === 'paid') {
          console.log('✅ Coach ya tiene pago completado (fallback desde analysisInfo)');
          setIsAlreadyPaid(true);
          openReviewNotice(coach);
          return;
        }
      }
    }
    
    // Abrir el diálogo después de verificar
    setUnlockDialogOpen(true);
  };

  const handleCreateUnlock = async () => {
    if (!analysisIdFromQuery || !unlockCoach) return;
    if (!user) {
      router.push('/login');
      return;
    }
    console.log('🚀 handleCreateUnlock llamado');
    console.log('🚀 paymentProvider en handleCreateUnlock:', paymentProvider);
    console.log('🚀 Tipo de paymentProvider:', typeof paymentProvider);
    try {
      setCreatingUnlock(true);
      setUnlockError(null);
      const token = await user.getIdToken();
      const requestBody = {
        analysisId: analysisIdFromQuery,
        coachId: unlockCoach.id,
        paymentProvider: paymentProvider,
      };
      console.log('📤 Request body completo:', JSON.stringify(requestBody, null, 2));
      const res = await fetch('/api/coach-unlocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });
      console.log('📤 Enviando request con paymentProvider (coaches/page.tsx):', paymentProvider);
      const data = await res.json();
      console.log('📥 Respuesta completa del servidor (coaches/page.tsx):', JSON.stringify(data, null, 2));
      if (!res.ok) {
        if (res.status === 409) {
          if (data?.code === 'PAYMENT_PENDING') {
            setIsAlreadyPaid(false);
            setUnlockError(data?.error || 'Ya tienes un pago pendiente para este entrenador.');
            return;
          }
          // Ya está pagado - mostrar como información
          setIsAlreadyPaid(true);
          setUnlockError(null);
          openReviewNotice(unlockCoach);
          return;
        }
        // Si es error de monto mínimo, mostrar mensaje específico
        if (res.status === 400 && data?.code === 'AMOUNT_TOO_LOW') {
          setUnlockError(data?.error || 'El monto es demasiado bajo para pagos con tarjeta. Por favor, usa MercadoPago para este monto.');
          toast({
            title: 'Monto mínimo requerido',
            description: data?.error || 'El monto es demasiado bajo para pagos con tarjeta. Por favor, selecciona MercadoPago.',
            variant: 'destructive',
          });
          return;
        }
        throw new Error(data?.error || 'No se pudo iniciar el pago.');
      }
      // El servidor devuelve camelCase: initPoint, sandboxInitPoint, checkoutUrl, redirectUrl
      const redirectUrl = data?.initPoint || 
                         data?.sandboxInitPoint || 
                         data?.checkoutUrl || 
                         data?.redirectUrl ||
                         // También buscar en snake_case por compatibilidad
                         data?.init_point || 
                         data?.sandbox_init_point || 
                         data?.checkout_url;
      console.log('🔗 URL de redirección encontrada (coaches/page.tsx):', redirectUrl);
      console.log('🔗 paymentProvider usado:', paymentProvider);
      if (redirectUrl && typeof redirectUrl === 'string' && redirectUrl.length > 0) {
        console.log('✅ Redirigiendo a:', redirectUrl);
        console.log('✅ paymentProvider usado:', paymentProvider);
        // Redirigir inmediatamente - no esperar
        window.location.href = redirectUrl;
      } else {
        console.error('❌ No se encontró URL de redirección en la respuesta');
        console.error('📋 Datos completos:', data);
        toast({
          title: 'Solicitud creada',
          description: 'Te avisaremos cuando el pago se confirme.',
        });
        setUnlockDialogOpen(false);
      }
    } catch (error: any) {
      setUnlockError(error?.message || 'Error inesperado al iniciar el pago.');
    } finally {
      setCreatingUnlock(false);
    }
  };

  const handleUseFreeReview = async () => {
    if (!analysisIdFromQuery || !unlockCoach) return;
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      setUsingFreeReview(true);
      setUnlockError(null);
      const token = await user.getIdToken();
      const res = await fetch('/api/coach-unlocks/free', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisId: analysisIdFromQuery,
          coachId: unlockCoach.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setIsAlreadyPaid(true);
          setUnlockError(null);
          return;
        }
        throw new Error(data?.error || 'No se pudo usar la revisión gratis.');
      }
      setIsAlreadyPaid(true);
      setPaidCoachIds((prev) => prev.includes(unlockCoach.id) ? prev : [...prev, unlockCoach.id]);
      setFreeCoachReviews(Number(data?.freeCoachReviewsLeft ?? Math.max(0, freeCoachReviews - 1)));
      toast({
        title: 'Revisión gratis aplicada',
        description: 'El entrenador ya tiene acceso al análisis.',
      });
      openReviewNotice(unlockCoach);
      setUnlockDialogOpen(false);
      router.refresh();
    } catch (error: any) {
      setUnlockError(error?.message || 'Error inesperado al usar revisión gratis.');
    } finally {
      setUsingFreeReview(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!analysisIdFromQuery || !unlockCoach) return;
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      setSimulatingPayment(true);
      setUnlockError(null);
      const token = await user.getIdToken();
      const res = await fetch('/api/coach-unlocks/simulate-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisId: analysisIdFromQuery,
          coachId: unlockCoach.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          // Ya está pagado - mostrar como información
          setIsAlreadyPaid(true);
          setUnlockError(null);
          return;
        }
        throw new Error(data?.error || 'No se pudo simular el pago.');
      }
      toast({
        title: 'Pago simulado',
        description: 'El análisis está desbloqueado. El entrenador puede verlo ahora.',
      });
      openReviewNotice(unlockCoach);
      setUnlockDialogOpen(false);
      // Recargar la página para actualizar el estado
      router.refresh();
    } catch (error: any) {
      setUnlockError(error?.message || 'Error inesperado al simular el pago.');
    } finally {
      setSimulatingPayment(false);
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
      </div>

      {analysisIdFromQuery && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-primary font-medium">Solicitud de revisión manual</p>
              <div className="text-sm text-muted-foreground">
                {analysisInfoLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando detalles...
                  </span>
                ) : analysisInfo ? (
                  <>
                    {analysisInfo.shotType ? `${analysisInfo.shotType} • ` : ''}
                    {analysisInfo.createdAt ? formatAnalysisDate(analysisInfo.createdAt) : ''}
                  </>
                ) : (
                  <span className="text-destructive">
                    {analysisInfoError || 'No encontramos ese análisis.'}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Elegí el entrenador que querés que realice la devolución. Cada entrenador muestra su tarifa por análisis. Al completar el pago, se agregará un 30% adicional por costo de servicio de la plataforma. Al hacer clic en "Solicitar revisión" verás el detalle completo del pago y podrás completarlo para habilitar el acceso.
              </p>
              <p className="text-sm text-primary font-semibold mt-2">
                ✨ Además, al completar el pago te regalamos 2 análisis gratis adicionales con IA
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
          Mostrando {filteredCoaches.length} de {visibleCoachesCount} entrenadores
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
              {/* Curriculum */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" /> 
                  Curriculum
                </h4>
                <p className="text-sm text-muted-foreground">{coach.experience}</p>
              </div>

              {/* Bio */}
              {coach.bio && (
                <div>
                  <h4 className="font-semibold mb-2">Curriculum</h4>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {coach.bio}
                  </p>
                  {coach.bio.length > 150 && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="link" className="text-xs p-0 h-auto mt-1 text-primary">
                          Ver curriculum completo
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Curriculum - {coach.name}</DialogTitle>
                          <DialogDescription>
                            Información completa del entrenador
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {coach.bio}
                            </p>
                          </div>
                          {coach.experience && (
                            <div>
                              <h4 className="font-semibold mb-2">Experiencia</h4>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {coach.experience}
                              </p>
                            </div>
                          )}
                          {coach.certifications && coach.certifications.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-primary" />
                                Certificaciones
                              </h4>
                              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                {coach.certifications.map((cert, idx) => (
                                  <li key={idx}>{cert}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {coach.specialties && coach.specialties.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-2">Especialidades</h4>
                              <div className="flex flex-wrap gap-1">
                                {coach.specialties.map((spec, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {spec}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {coach.education && (
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <GraduationCap className="h-5 w-5 text-primary" />
                                Educación
                              </h4>
                              <p className="text-sm text-muted-foreground">{coach.education}</p>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              )}

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
              {/* Tarifa: mostrar siempre si existe ratePerAnalysis */}
              {(() => {
                const displayRate = getDisplayRate(coach);
                return typeof displayRate === 'number' ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex justify-center items-baseline">
                      <span className="font-headline text-3xl font-bold text-primary">
                        ${displayRate.toLocaleString('es-AR')}
                      </span>
                      <span className="text-sm text-muted-foreground">/análisis</span>
                    </div>
                    <div className="text-xs text-muted-foreground text-center">
                      + 30% costo de servicio
                    </div>
                    <div className="text-sm font-semibold text-primary text-center">
                      Total: ${(displayRate + Math.max(1, Math.round(displayRate * 0.3))).toLocaleString('es-AR')}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Dialog open={helpOpenFor?.id === coach.id} onOpenChange={(open) => setHelpOpenFor(open ? coach : null)}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Enviar mensaje
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Enviar mensaje a {coach.name}</DialogTitle>
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
                            const appBaseUrl = getClientAppBaseUrl();
                            const analysisUrl = analysisIdFromQuery && appBaseUrl
                              ? `${appBaseUrl}/analysis/${analysisIdFromQuery}`
                              : '';
                            const appendedText = analysisUrl && !helpMessage.includes(analysisUrl)
                              ? `${helpMessage}\n\nLink al análisis: ${analysisUrl}`
                              : helpMessage;
                            const payload = {
                              fromId: user.uid,
                              fromName: (userProfile as any)?.name || user.displayName || 'Jugador',
                              fromAvatarUrl: (userProfile as any)?.avatarUrl || '',
                              toId: coach.id,
                              toCoachDocId: coach.id,
                              toName: coach.name,
                              text: appendedText,
                              analysisId: analysisIdFromQuery || null,
                              createdAt: serverTimestamp(),
                              read: false,
                              messageType: getMessageType({ fromId: user.uid, analysisId: analysisIdFromQuery || null }),
                              conversationId: buildConversationId({
                                fromId: user.uid,
                                toId: coach.id,
                                analysisId: analysisIdFromQuery || null,
                              }),
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
                    handleRequestReview(coach);
                  }}
                  variant={paidCoachIds.includes(coach.id) ? 'outline' : 'default'}
                >
                  <Users className="mr-2 h-4 w-4" /> 
                  {analysisIdFromQuery 
                    ? (paidCoachIds.includes(coach.id) ? 'Ya abonado' : 'Solicitar revisión')
                    : 'Solicitar revisión'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog
        open={unlockDialogOpen}
        onOpenChange={(open) => {
          setUnlockDialogOpen(open);
          if (!open) {
            setUnlockCoach(null);
            setUnlockError(null);
            setIsAlreadyPaid(false);
            setPaymentProvider('mercadopago'); // Reset al cerrar
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="break-words">
              {unlockCoach ? `Solicitar revisión con ${unlockCoach.name}` : 'Solicitar revisión'}
            </DialogTitle>
            <DialogDescription className="break-words">
              El pago desbloqueará el análisis para que el entrenador pueda ver tus videos y dejar la devolución.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {analysisIdFromQuery ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium min-w-0 break-words">Análisis</span>
                </div>
                <div className="mt-2 text-muted-foreground break-words">
                  {analysisInfoLoading && (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando análisis...
                    </span>
                  )}
                  {!analysisInfoLoading && analysisInfo && (
                    <>
                      <p className="break-words">{analysisInfo.shotType || 'Análisis de tiro'}</p>
                      {analysisInfo.createdAt && (
                        <p className="break-words">Subido el {formatAnalysisDate(analysisInfo.createdAt)}</p>
                      )}
                    </>
                  )}
                  {!analysisInfoLoading && analysisInfoError && (
                    <p className="text-destructive break-words">{analysisInfoError}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-destructive">
                Para solicitar una revisión manual entrá desde el botón de un análisis en tu panel.
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
                  {coachRate != null ? `$${coachRate.toLocaleString('es-AR')}` : 'No disponible'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span className="min-w-0 break-words">Costo de servicio de la plataforma (30%)</span>
                <span className="flex-shrink-0 whitespace-nowrap">{platformFee != null ? `$${platformFee.toLocaleString('es-AR')}` : '-'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t font-semibold text-lg">
                <span className="min-w-0 break-words">Total a pagar</span>
                <span className="flex-shrink-0 whitespace-nowrap text-primary">
                  {totalAmount != null ? `$${totalAmount.toLocaleString('es-AR')}` : '-'}
                </span>
              </div>
            </div>

            {freeCoachReviews > 0 && !isAlreadyPaid && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="font-medium">Tenés {freeCoachReviews} revisión{freeCoachReviews === 1 ? '' : 'es'} gratis disponible{freeCoachReviews === 1 ? '' : 's'}.</p>
                <p className="text-emerald-800 text-xs mt-1">
                  Podés usar una revisión gratis para desbloquear este entrenador sin pagar.
                </p>
              </div>
            )}

            {/* Selector de método de pago - SIEMPRE visible */}
            <div className="rounded-md border p-3 text-sm space-y-2 bg-blue-50 border-blue-200">
              <label className="font-medium">Método de pago</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={paymentProvider === 'mercadopago' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    console.log('🔘 Seleccionando MercadoPago');
                    setPaymentProvider('mercadopago');
                  }}
                >
                  {paymentProvider === 'mercadopago' && '✓ '}MercadoPago
                </Button>
                <Button
                  type="button"
                  variant={paymentProvider === 'dlocal' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    console.log('🔘 Seleccionando Tarjeta de crédito/débito (dLocal)');
                    setPaymentProvider('dlocal');
                  }}
                >
                  {paymentProvider === 'dlocal' && '✓ '}Tarjeta de crédito o débito
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Seleccionado: <strong>{paymentProvider === 'mercadopago' ? 'MercadoPago' : 'Tarjeta de crédito o débito'}</strong>
              </p>
            </div>

            {!isAlreadyPaid && (
              <p className="text-xs text-muted-foreground break-words">
                Después del pago, el entrenador recibirá una notificación y podrás escribirle para coordinar la devolución personalizada.
              </p>
            )}

            {isAlreadyPaid && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                <div className="flex items-start gap-2">
                  <svg className="h-5 w-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">✅ Análisis ya abonado para este entrenador</p>
                    <p className="text-green-700 mt-1 break-words">
                      Ya pagaste para que {unlockCoach?.name || 'este entrenador'} analice tu lanzamiento. El entrenador ya tiene acceso al análisis.
                    </p>
                    <p className="text-green-700 mt-2 font-semibold break-words">
                      ⏳ Falta que el entrenador evalúe tu análisis. Te notificaremos cuando deje su devolución.
                    </p>
                    <p className="text-green-700 mt-2 break-words">
                      Si querés otra revisión con un entrenador distinto, podés elegirlo en esta lista y pagar una nueva revisión.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {unlockError && !isAlreadyPaid && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive break-words">
                {unlockError}
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isAlreadyPaid ? (
              <>
                <Button variant="outline" onClick={() => setUnlockDialogOpen(false)}>
                  Elegir otro entrenador
                </Button>
                {analysisIdFromQuery && (
                  <Button asChild>
                    <Link href={`/analysis/${analysisIdFromQuery}`}>
                      Ir al análisis
                    </Link>
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setUnlockDialogOpen(false)} disabled={creatingUnlock || simulatingPayment}>
                  Cancelar
                </Button>
                {freeCoachReviews > 0 && (
                  <Button
                    variant="secondary"
                    onClick={handleUseFreeReview}
                    disabled={
                      usingFreeReview ||
                      creatingUnlock ||
                      simulatingPayment ||
                      !analysisIdFromQuery ||
                      !unlockCoach ||
                      analysisInfoLoading
                    }
                  >
                    {usingFreeReview ? 'Usando revisión...' : 'Usar revisión gratis'}
                  </Button>
                )}
                <Button
                  onClick={handleCreateUnlock}
                  disabled={
                    creatingUnlock ||
                    usingFreeReview ||
                    simulatingPayment ||
                    !analysisIdFromQuery ||
                    !unlockCoach ||
                    coachRate == null ||
                    platformFee == null ||
                    analysisInfoLoading
                  }
                >
                  {creatingUnlock ? 'Abriendo pago...' : 'Pagar y solicitar revisión'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={reviewNoticeOpen} onOpenChange={setReviewNoticeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revisión solicitada</AlertDialogTitle>
            <AlertDialogDescription>
              {reviewNoticeCoachName} ya tiene el análisis a disposición para revisarlo y dejar su devolución. Te avisaremos cuando responda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
            {analysisIdFromQuery && (
              <AlertDialogAction onClick={() => router.push(`/analysis/${analysisIdFromQuery}`)}>
                Ir al análisis
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </div>
  );
}
