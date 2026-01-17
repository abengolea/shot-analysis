"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Video, MessageSquare, Clock } from "lucide-react";
import type { Message, Player } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, where, updateDoc, doc, addDoc, serverTimestamp, setDoc, getDoc, limit, getDocs } from "firebase/firestore";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function CoachDashboardPage() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([] as any);
  const [messages, setMessages] = useState<Message[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [coachProfile, setCoachProfile] = useState<any | null>(null);
  const [rateDraft, setRateDraft] = useState<string>("");
  const [rateDirty, setRateDirty] = useState<boolean>(false);
  const rateDirtyRef = useRef(false);
  const [savingRate, setSavingRate] = useState<boolean>(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("messages");
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [playersSearch, setPlayersSearch] = useState<string>("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<'all'|'pending'|'analyzed'>("all");
  const [hiddenMessageIds, setHiddenMessageIds] = useState<string[]>([]);
  useEffect(() => {
    rateDirtyRef.current = rateDirty;
  }, [rateDirty]);

  useEffect(() => {
    if (!user) return;
    try {
      const coachRef = doc(db as any, 'coaches', user.uid);
      const unsub = onSnapshot(coachRef, (snap) => {
        if (!snap.exists()) {
          setCoachProfile(null);
          return;
        }
        const data = { id: snap.id, ...(snap.data() as any) };
        setCoachProfile(data);
        if (!rateDirtyRef.current) {
          setRateDraft(typeof data.ratePerAnalysis === 'number' ? String(data.ratePerAnalysis) : '');
        }
      }, (error) => {
        console.error('Error cargando perfil de coach:', error);
      });
      return () => unsub();
    } catch (e) {
      console.error('Error inicializando perfil de coach:', e);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    try {
      const q = query(collection(db as any, 'players'), where('coachId', '==', user.uid));
      const unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any[];
        setPlayers(list as any);
      }, (error) => {
        console.error('Error en listener de jugadores:', error);
      });
      return () => unsub();
    } catch (e) {
      console.error('Error cargando jugadores del coach:', e);
    }
  }, [user]);

  // Cargar análisis de todos los jugadores del coach (en tiempo real, chunked por 10 ids)
  useEffect(() => {
    if (!user) return;
    let unsubs: Array<() => void> = [];
    const chunkMap: Record<string, any[]> = {};
    try {
      const ids = players.map((p) => p.id).filter(Boolean);
      // Limpiar si no hay jugadores
      if (ids.length === 0) {
        setAnalyses([]);
        return;
      }
      // Partir en chunks de 10 para 'in'
      for (let i = 0; i < ids.length; i += 10) {
        const chunk = ids.slice(i, i + 10);
        const key = chunk.join(',');
        const q = query(collection(db as any, 'analyses'), where('playerId', 'in', chunk));
        const u = onSnapshot(q, (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          chunkMap[key] = list;
          const merged = Object.values(chunkMap).flat();
          // Ordenar por fecha descendente
          merged.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          
          console.log(`[Coach Dashboard] Total análisis cargados antes de filtrar: ${merged.length}`);
          console.log(`[Coach Dashboard] Jugadores asignados:`, players.map(p => ({ id: p.id, name: p.name })));
          console.log(`[Coach Dashboard] UID del coach: ${user?.uid}`);
          
          const filtered = merged.filter((a: any) => {
            if (!user?.uid) return false;
            
            // Debug específico para el análisis que no aparece
            if (a.id === 'analysis_1760697596386_2z0qcauew') {
              console.log(`🔍🔍🔍 [Coach Dashboard] DEBUG ESPECÍFICO analysis_1760697596386_2z0qcauew 🔍🔍🔍`, {
                analysisId: a.id,
                playerId: a.playerId,
                playerName: players.find(p => p.id === a.playerId)?.name || 'Unknown',
                isPlayerInList: players.some(p => p.id === a.playerId),
                coachAccess: a.coachAccess,
                coachAccessKeys: a.coachAccess ? Object.keys(a.coachAccess) : [],
                userUid: user.uid,
                hasCoachAccess: !!a.coachAccess,
                coachAccessForUser: a.coachAccess?.[user.uid],
                coachAccessStatus: a.coachAccess?.[user.uid]?.status,
                status: a.status,
                createdAt: a.createdAt
              });
            }
            
            const access = (a as any).coachAccess || {};
            const coachAccess = access[user.uid];
            
            // Debug: log para ver qué análisis se están filtrando
            if (!coachAccess || coachAccess.status !== 'paid') {
              if (a.id === 'analysis_1760697596386_2z0qcauew') {
                console.log(`❌❌❌ [Coach Dashboard] analysis_1760697596386_2z0qcauew FILTRADO - RAZÓN:`, {
                  reason: !coachAccess ? 'No tiene coachAccess para este coach UID' : `Status es '${coachAccess.status}' no 'paid'`,
                  playerId: a.playerId,
                  playerName: players.find(p => p.id === a.playerId)?.name || 'Unknown',
                  createdAt: a.createdAt,
                  hasCoachAccess: !!access,
                  coachIds: Object.keys(access),
                  userUid: user.uid,
                  coachAccess: coachAccess,
                  status: a.status
                });
              }
              console.log(`[Coach Dashboard] ❌ Análisis ${a.id} filtrado (NO PAGADO):`, {
                playerId: a.playerId,
                playerName: players.find(p => p.id === a.playerId)?.name || 'Unknown',
                createdAt: a.createdAt,
                hasCoachAccess: !!access,
                coachIds: Object.keys(access),
                userUid: user.uid,
                coachAccess: coachAccess,
                status: a.status
              });
            } else {
              if (a.id === 'analysis_1760697596386_2z0qcauew') {
                console.log(`✅✅✅ [Coach Dashboard] analysis_1760697596386_2z0qcauew INCLUIDO ✅✅✅`);
              }
              console.log(`[Coach Dashboard] ✅ Análisis ${a.id} INCLUIDO (PAGADO):`, {
                playerId: a.playerId,
                playerName: players.find(p => p.id === a.playerId)?.name || 'Unknown',
                createdAt: a.createdAt
              });
            }
            // Solo mostrar análisis con acceso pagado
            return coachAccess && coachAccess.status === 'paid';
          });
          
          console.log(`[Coach Dashboard] Total análisis después de filtrar: ${filtered.length}`);
          const analysis1760 = filtered.find(a => a.id === 'analysis_1760697596386_2z0qcauew');
          if (analysis1760) {
            console.log(`✅ [Coach Dashboard] analysis_1760697596386_2z0qcauew está en el array filtered:`, {
              id: analysis1760.id,
              status: analysis1760.status,
              playerId: analysis1760.playerId,
              createdAt: analysis1760.createdAt
            });
          } else {
            console.log(`❌ [Coach Dashboard] analysis_1760697596386_2z0qcauew NO está en el array filtered`);
          }
          console.log(`[Coach Dashboard] Análisis incluidos:`, filtered.map(a => ({ 
            id: a.id, 
            playerId: a.playerId, 
            status: a.status,
            createdAt: a.createdAt 
          })));
          setAnalyses(filtered as any[]);
        }, (err) => {
          console.error('Error cargando análisis (chunk):', err);
        });
        unsubs.push(u);
      }
    } catch (e) {
      console.error('Error cargando análisis:', e);
    }
    return () => { unsubs.forEach((u) => u()); };
  }, [user, players]);

  // Sincronizar pestaña con hash (#messages | #players | #analyses)
  useEffect(() => {
    const allowed = new Set(["messages", "players", "analyses"]);
    const applyFromHash = () => {
      try {
        const h = (window.location.hash || '').replace('#', '');
        if (allowed.has(h)) setActiveTab(h);
      } catch {}
    };
    applyFromHash();
    const onHash = () => applyFromHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!user) return;
    try {
      const q1 = query(collection(db as any, 'messages'), where('toId', '==', user.uid), orderBy('createdAt', 'desc'));
      const q2 = query(collection(db as any, 'messages'), where('toCoachDocId', '==', user.uid), orderBy('createdAt', 'desc'));
      const unsubs: Array<() => void> = [];
      const apply = (snap: any) => {
        setMessages(prev => {
          const incoming = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as Message[];
          const merged = [...incoming, ...prev].reduce((acc: Record<string, Message>, m: Message) => { acc[m.id] = m; return acc; }, {} as any);
          return Object.values(merged).sort((a, b) => (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
        });
      };
      unsubs.push(onSnapshot(q1, apply, (error) => {
        console.error('Error en listener de mensajes coach (q1):', error);
      }));
      unsubs.push(onSnapshot(q2, apply, (error) => {
        console.error('Error en listener de mensajes coach (q2):', error);
      }));
      return () => { unsubs.forEach(u => u()); };
    } catch (e) {
      console.error('Error cargando mensajes:', e);
    }
  }, [user]);

  // Cargar mensajes ocultos desde localStorage al iniciar
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const stored = window.localStorage.getItem('coachHiddenMessageIds');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const validIds = parsed.filter((id) => typeof id === 'string');
          if (validIds.length > 0) {
            setHiddenMessageIds(validIds);
          }
        }
      }
    } catch (e) {
      console.warn('No se pudieron recuperar mensajes ocultos:', e);
    }
  }, []);

  // Guardar mensajes ocultos en localStorage cuando cambien
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (hiddenMessageIds.length > 0) {
        window.localStorage.setItem('coachHiddenMessageIds', JSON.stringify(hiddenMessageIds));
      } else {
        // Si no hay mensajes ocultos, limpiar el localStorage para mantenerlo limpio
        window.localStorage.removeItem('coachHiddenMessageIds');
      }
    } catch (e) {
      console.warn('No se pudieron guardar mensajes ocultos:', e);
    }
  }, [hiddenMessageIds]);

  const unreadCount = useMemo(() => messages.filter(m => !m.read).length, [messages]);
  const analyzedCount = useMemo(() => analyses.filter((a: any) => String(a.status) === 'analyzed' && a.coachCompleted === true).length, [analyses]);
  const pendingCount = useMemo(() => analyses.filter((a: any) => String(a.status) !== 'analyzed' || a.coachCompleted !== true).length, [analyses]);
  const visibleMessages = useMemo(() => {
    const filtered = unreadOnly ? messages.filter(m => !m.read) : messages;
    if (hiddenMessageIds.length === 0) return filtered;
    const hiddenSet = new Set(hiddenMessageIds);
    return filtered.filter((m) => !hiddenSet.has(m.id));
  }, [messages, unreadOnly, hiddenMessageIds]);
  const playerOptions = useMemo(() => [{ id: 'all', name: 'Todos' }, ...players.map(p => ({ id: p.id, name: p.name }))], [players]);
  const filteredAnalyses = useMemo(() => {
    let arr = analyses;
    if (selectedPlayerId !== 'all') arr = arr.filter((a: any) => a.playerId === selectedPlayerId);
    if (statusFilter === 'analyzed') arr = arr.filter((a: any) => String(a.status) === 'analyzed' && a.coachCompleted === true);
    if (statusFilter === 'pending') arr = arr.filter((a: any) => String(a.status) !== 'analyzed' || a.coachCompleted !== true);
    
    // Debug para el análisis específico
    const specificAnalysis = arr.find((a: any) => a.id === 'analysis_1760697596386_2z0qcauew');
    if (specificAnalysis) {
      console.log(`✅ [filteredAnalyses] analysis_1760697596386_2z0qcauew está en filteredAnalyses:`, {
        selectedPlayerId,
        statusFilter,
        analysisStatus: specificAnalysis.status,
        coachCompleted: specificAnalysis.coachCompleted,
        willShow: statusFilter === 'all' || (statusFilter === 'analyzed' && String(specificAnalysis.status) === 'analyzed' && specificAnalysis.coachCompleted === true) || (statusFilter === 'pending' && (String(specificAnalysis.status) !== 'analyzed' || specificAnalysis.coachCompleted !== true))
      });
    } else if (analyses.some((a: any) => a.id === 'analysis_1760697596386_2z0qcauew')) {
      console.log(`❌ [filteredAnalyses] analysis_1760697596386_2z0qcauew está en analyses pero NO en filteredAnalyses:`, {
        selectedPlayerId,
        statusFilter,
        analysisStatus: analyses.find((a: any) => a.id === 'analysis_1760697596386_2z0qcauew')?.status
      });
    }
    
    return arr;
  }, [analyses, selectedPlayerId, statusFilter]);
  const filteredPlayers = useMemo(() => {
    const term = playersSearch.trim().toLowerCase();
    if (!term) return players;
    return players.filter(p => p.name?.toLowerCase().includes(term));
  }, [players, playersSearch]);
  
  // Función helper para normalizar el nombre del remitente de mensajes del sistema
  const getDisplayName = (message: Message) => {
    const fromName = message.fromName || message.fromId;
    if (message.fromId === 'system' || fromName === 'Shot Analysis' || fromName === 'msjs del sistema' || fromName === 'Chaaaas.com') {
      return 'Chaaaas.com';
    }
    return fromName;
  };
  const isSystemMessage = (message: Message) => {
    const fromName = message.fromName || message.fromId;
    return message.fromId === 'system' || fromName === 'Shot Analysis' || fromName === 'msjs del sistema' || fromName === 'Chaaaas.com';
  };
  
  const markAsRead = async (m: Message) => {
    try {
      if (!m.read) {
        await updateDoc(doc(db as any, 'messages', m.id), { read: true, readAt: new Date().toISOString() });
      }
    } catch (e) {
      console.error('No se pudo marcar como leído:', e);
    }
  };

  const [replyFor, setReplyFor] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [sendingReply, setSendingReply] = useState<boolean>(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState<boolean>(false);
  const [acceptTargetUrl, setAcceptTargetUrl] = useState<string>("");
  const [acceptPlayerLabel, setAcceptPlayerLabel] = useState<string>("");
  const [rejectFor, setRejectFor] = useState<Message | null>(null);
  const [rejectText, setRejectText] = useState<string>("");
  const [rejecting, setRejecting] = useState<boolean>(false);
  const hideMessage = (id: string) => {
    setHiddenMessageIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };
  const restoreHiddenMessages = () => setHiddenMessageIds([]);

  const sendReply = async () => {
    if (!user || !replyFor || !replyText.trim()) return;
    try {
      setSendingReply(true);
      const colRef = collection(db as any, 'messages');
      const payload = {
        fromId: user.uid,
        fromName: 'Entrenador',
        toId: replyFor.fromId,
        toName: replyFor.fromName || replyFor.fromId,
        text: replyText.trim(),
        createdAt: serverTimestamp(),
        read: false,
      } as any;
      await addDoc(colRef, payload);
      setReplyText("");
      setReplyFor(null);
    } catch (e) {
      console.error('Error enviando respuesta:', e);
    } finally {
      setSendingReply(false);
    }
  };

  const acceptPlayer = async (m: Message) => {
    try {
      setAcceptingId(m.id);
      // Vincula al jugador con el coach: set players/{fromId}.coachId = coach uid
      const playerRef = doc(db as any, 'players', m.fromId);
      const snap = await getDoc(playerRef);
      if (!snap.exists()) {
        console.warn('No existe el doc del jugador para vincular');
        toast({ title: 'No se pudo aceptar', description: 'No encontramos el perfil del jugador.', variant: 'destructive' });
        setAcceptingId(null);
        return;
      }
      await setDoc(playerRef, { coachId: user?.uid, updatedAt: new Date() }, { merge: true });
      // Marcar el mensaje como leído
      await updateDoc(doc(db as any, 'messages', m.id), { read: true, readAt: new Date().toISOString() });
      // Buscar último análisis del jugador
      let targetUrl = `/coach/players/${m.fromId}`;
      try {
        const qa = query(collection(db as any, 'analyses'), where('playerId', '==', m.fromId), orderBy('createdAt', 'desc'), limit(1));
        const res = await getDocs(qa);
        if (!res.empty) {
          const docId = res.docs[0].id;
          targetUrl = `/analysis/${docId}`;
        }
      } catch {}
      setAcceptTargetUrl(targetUrl);
      setAcceptPlayerLabel(m.fromName || m.fromId);
      setAcceptDialogOpen(true);
    } catch (e) {
      console.error('Error aceptando jugador:', e);
      toast({ title: 'Error', description: 'No se pudo aceptar la propuesta.', variant: 'destructive' });
    } finally {
      setAcceptingId(null);
    }
  };

  const sendReject = async () => {
    if (!user || !rejectFor || !rejectText.trim()) return;
    try {
      setRejecting(true);
      const colRef = collection(db as any, 'messages');
      const payload = {
        fromId: user.uid,
        fromName: user.displayName || 'Entrenador',
        toId: rejectFor.fromId,
        toName: rejectFor.fromName || rejectFor.fromId,
        text: rejectText.trim(),
        createdAt: serverTimestamp(),
        read: false,
      } as any;
      await addDoc(colRef, payload);
      // Marcar el mensaje original como leído
      try { await updateDoc(doc(db as any, 'messages', rejectFor.id), { read: true, readAt: new Date().toISOString() }); } catch {}
      setRejectFor(null);
      setRejectText("");
      toast({ title: 'Rechazado', description: 'Se envió tu respuesta al jugador.' });
    } catch (e) {
      console.error('Error enviando rechazo:', e);
      toast({ title: 'Error', description: 'No se pudo enviar el rechazo.', variant: 'destructive' });
    } finally {
      setRejecting(false);
    }
  };

  const saveRatePerAnalysis = async () => {
    if (!user) return;
    const parsed = Number(rateDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRateError('Ingresá un monto mayor a 0.');
      return;
    }
    setRateError(null);
    try {
      setSavingRate(true);
      const coachRef = doc(db as any, 'coaches', user.uid);
      await updateDoc(coachRef, {
        ratePerAnalysis: parsed,
        updatedAt: new Date().toISOString(),
      });
      setRateDirty(false);
      toast({ title: 'Tarifa actualizada', description: `Nueva tarifa: $${parsed}` });
    } catch (e) {
      console.error('Error guardando tarifa:', e);
      setRateError('No se pudo guardar la tarifa. Intenta de nuevo.');
    } finally {
      setSavingRate(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          Panel de Entrenador{userProfile?.name ? `: ${userProfile.name}` : ''}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Gestiona tus jugadores y revisa las solicitudes de conexión.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-md" onClick={() => { window.location.href = '/coach/dashboard#players'; }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Jugadores
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{players.length}</div>
            <p className="text-xs text-muted-foreground">
              jugadores actualmente bajo tu tutela
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => { window.location.href = '/coach/dashboard#analyses'; }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Análisis Realizados
            </CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyzedCount}</div>
            <p className="text-xs text-muted-foreground">
              {pendingCount > 0 ? `${pendingCount} pendientes` : 'sin pendientes'}
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => { 
          setStatusFilter('pending');
          setActiveTab('analyses');
          window.location.hash = 'analyses';
        }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Análisis Pendientes
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">
              esperando tu revisión
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => { window.location.href = '/coach/dashboard#messages'; }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Mensajes no leídos
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{unreadCount}</div>
            <p className="text-xs text-muted-foreground">
              esperando tu respuesta
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Tarifa por análisis</CardTitle>
            <CardDescription>
              Esta tarifa se muestra a los jugadores y se usa al momento de cobrar cada revisión manual.
            </CardDescription>
          </div>
          {typeof coachProfile?.ratePerAnalysis === 'number' && (
            <Badge variant="secondary" className="text-base px-3 py-1">
              Tarifa vigente: ${coachProfile.ratePerAnalysis}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Monto en ARS</label>
              <Input
                type="number"
                min="1"
                step="1"
                value={rateDraft}
                onChange={(e) => { setRateDraft(e.target.value); setRateDirty(true); setRateError(null); }}
                placeholder="Ej: 15000"
              />
              {rateError && <p className="text-sm text-destructive mt-1">{rateError}</p>}
              <p className="text-xs text-muted-foreground mt-1">
                Recomendado: valores entre $10.000 y $50.000 ARS según tu experiencia.
              </p>
            </div>
            <Button
              className="sm:w-auto"
              onClick={saveRatePerAnalysis}
              disabled={savingRate || !rateDirty || !rateDraft.trim()}
            >
              {savingRate ? 'Guardando…' : 'Guardar tarifa'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); try { if ((window.location.hash || '').replace('#','') !== v) window.location.hash = v; } catch {} }} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger id="messages" value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Mensajes
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1">{unreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger id="players" value="players" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Mis Jugadores
          </TabsTrigger>
          <TabsTrigger id="analyses" value="analyses" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Analisis
          </TabsTrigger>
        </TabsList>

        <TabsContent id="messages" value="messages" className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Mensajes</h2>
              <p className="text-muted-foreground">Mensajes recibidos de jugadores.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
                Solo no leídos
              </label>
              {hiddenMessageIds.length > 0 && (
                <button
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                  onClick={restoreHiddenMessages}
                >
                  Mostrar ocultos ({hiddenMessageIds.length})
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-4">
            {visibleMessages.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">Sin mensajes</div>
            )}
            {visibleMessages.map((m) => (
              <Card key={m.id} className="hover:shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    {getDisplayName(m)}
                    {!m.read && <Badge variant="secondary" className="ml-2">Nuevo</Badge>}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-3">
                    {!m.read && (
                      <button className="text-xs text-primary" onClick={() => markAsRead(m)}>Marcar leído</button>
                    )}
                    {!isSystemMessage(m) && (
                      <>
                        <button className="text-xs text-green-600 disabled:opacity-50" disabled={acceptingId === m.id} onClick={() => acceptPlayer(m)}>
                          {acceptingId === m.id ? 'Aceptando…' : 'Aceptar propuesta'}
                        </button>
                        <Dialog open={rejectFor?.id === m.id} onOpenChange={(open) => { if (open) { setRejectFor(m); setRejectText(`Lamentablemente no puedo ayudarte en este momento. ¡Gracias por contactarme!\n\n— ${user?.displayName || 'Entrenador'}`); } else { setRejectFor(null); setRejectText(""); } }}>
                          <DialogTrigger asChild>
                            <button className="text-xs text-red-600">Rechazar</button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Rechazar solicitud de {getDisplayName(m)}</DialogTitle>
                              <DialogDescription>Envía un mensaje opcional para explicar el rechazo.</DialogDescription>
                            </DialogHeader>
                            <Textarea value={rejectText} onChange={(e) => setRejectText(e.target.value)} rows={4} />
                            <DialogFooter>
                              <Button onClick={sendReject} disabled={rejecting || !rejectText.trim()} variant="destructive">
                                {rejecting ? 'Enviando…' : 'Enviar rechazo'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}
                    {!isSystemMessage(m) && (
                      <Dialog open={replyFor?.id === m.id} onOpenChange={(open) => { setReplyFor(open ? m : null); if (!open) setReplyText(""); }}>
                        <DialogTrigger asChild>
                          <button className="text-xs text-primary">Responder</button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Responder a {getDisplayName(m)}</DialogTitle>
                            <DialogDescription>Escribe tu respuesta y se enviará al jugador.</DialogDescription>
                          </DialogHeader>
                          <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={4} />
                          <DialogFooter>
                            <Button onClick={sendReply} disabled={sendingReply || !replyText.trim()}>
                              {sendingReply ? 'Enviando…' : 'Enviar'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                    <button className="text-xs text-muted-foreground" onClick={() => hideMessage(m.id)}>
                      Ocultar
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-1">
                    {new Date(m.createdAt || Date.now()).toLocaleString()}
                  </div>
                  <div className="text-sm">{m.text}</div>
                  {/* Mostrar botón para ir al análisis si el mensaje tiene analysisId */}
                  {(() => {
                    // Usar analysisId del mensaje si está disponible, sino intentar extraerlo del texto
                    const analysisId = (m as any).analysisId || m.text?.match(/(analysis_[a-zA-Z0-9_-]+)/i)?.[1];
                    if (analysisId) {
                      return (
                        <div className="mt-3 pt-3 border-t">
                          <Button asChild size="sm" variant="default">
                            <Link href={`/analysis/${analysisId}`}>
                              Ver análisis
                            </Link>
                          </Button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent id="players" value="players" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Mis Jugadores</h2>
            <p className="text-muted-foreground">
              Selecciona un jugador para ver su perfil detallado y su historial de análisis.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Input placeholder="Buscar jugador..." value={playersSearch} onChange={(e) => setPlayersSearch(e.target.value)} />
            </div>
            <div className="divide-y rounded-md border">
              {filteredPlayers.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">No hay jugadores</div>
              )}
              {filteredPlayers.map((p) => (
                <Link 
                  key={p.id} 
                  href={`/coach/players/${p.id}`} 
                  className="flex items-center gap-3 p-3 hover:bg-muted/40"
                  onClick={(e) => {
                    // Asegurar que la navegación funcione
                    console.log('Navegando a jugador:', p.id);
                  }}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={p.avatarUrl} alt={p.name} />
                    <AvatarFallback>{p.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.playerLevel || 'Nivel'} · {p.ageGroup || 'Grupo'}</div>
                  </div>
                  <span className="text-xs text-primary">Ver</span>
                </Link>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent id="analyses" value="analyses" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Analisis</h2>
            <p className="text-muted-foreground">Lista de análisis realizados y pendientes.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-56">
              <Select value={selectedPlayerId} onValueChange={(v) => setSelectedPlayerId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Jugador" />
                </SelectTrigger>
                <SelectContent>
                  {playerOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-56">
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="analyzed">Realizados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Pendientes ({filteredAnalyses.filter((a: any) => String(a.status) !== 'analyzed' || a.coachCompleted !== true).length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredAnalyses.filter((a: any) => String(a.status) !== 'analyzed' || a.coachCompleted !== true).length === 0 && (
                  <div className="text-sm text-muted-foreground">No hay análisis pendientes.</div>
                )}
                {filteredAnalyses.filter((a: any) => {
                  const isPending = String(a.status) !== 'analyzed' || a.coachCompleted !== true;
                  // Debug para el análisis específico
                  if (a.id === 'analysis_1760697596386_2z0qcauew') {
                    console.log(`🔍 [Pendientes] Verificando analysis_1760697596386_2z0qcauew:`, {
                      status: a.status,
                      statusAsString: String(a.status),
                      isPending,
                      willShow: isPending
                    });
                  }
                  return isPending;
                }).map((a: any) => {
                  const p = players.find((pl) => pl.id === a.playerId);
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-3 border rounded-md p-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p?.name || a.playerId}</div>
                        <div className="text-xs text-muted-foreground truncate">{new Date(a.createdAt || Date.now()).toLocaleString()}</div>
                      </div>
                      <Link href={`/analysis/${a.id}`} className="text-xs text-primary shrink-0">Ver</Link>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Realizados ({filteredAnalyses.filter((a: any) => String(a.status) === 'analyzed' && a.coachCompleted === true).length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredAnalyses.filter((a: any) => String(a.status) === 'analyzed' && a.coachCompleted === true).length === 0 && (
                  <div className="text-sm text-muted-foreground">Aún no hay análisis realizados.</div>
                )}
                {filteredAnalyses.filter((a: any) => {
                  const isAnalyzed = String(a.status) === 'analyzed' && a.coachCompleted === true;
                  // Debug para el análisis específico
                  if (a.id === 'analysis_1760697596386_2z0qcauew') {
                    console.log(`🔍 [Realizados] Verificando analysis_1760697596386_2z0qcauew:`, {
                      status: a.status,
                      statusAsString: String(a.status),
                      isAnalyzed,
                      willShow: isAnalyzed,
                      inFilteredAnalyses: filteredAnalyses.some(fa => fa.id === 'analysis_1760697596386_2z0qcauew'),
                      filteredAnalysesLength: filteredAnalyses.length
                    });
                  }
                  return isAnalyzed;
                }).map((a: any) => {
                  // Debug adicional para verificar que se está renderizando
                  if (a.id === 'analysis_1760697596386_2z0qcauew') {
                    console.log(`✅✅✅ [Realizados] RENDERIZANDO analysis_1760697596386_2z0qcauew ✅✅✅`);
                  }
                  const p = players.find((pl) => pl.id === a.playerId);
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-3 border rounded-md p-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p?.name || a.playerId}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {a.coachCompletedAt 
                            ? new Date(a.coachCompletedAt).toLocaleString('es-ES')
                            : a.updatedAt 
                              ? new Date(a.updatedAt).toLocaleString('es-ES')
                              : new Date(a.createdAt || Date.now()).toLocaleString('es-ES')}
                        </div>
                      </div>
                      <Link href={`/analysis/${a.id}`} className="text-xs text-primary shrink-0">Abrir</Link>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal centrado para éxito de aceptación */}
      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Jugador vinculado</DialogTitle>
            <DialogDescription>
              {acceptPlayerLabel ? `Ya podés trabajar con ${acceptPlayerLabel}.` : 'Ya podés trabajar con el jugador.'}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Te llevo al último análisis del jugador (si existe); si no, a su perfil.
          </div>
          <DialogFooter>
            <Button onClick={() => { if (acceptTargetUrl) window.location.href = acceptTargetUrl; }}>Ver ahora</Button>
            <Button variant="outline" onClick={() => setAcceptDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
