"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { collection, onSnapshot, orderBy, query, where, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { getAuth, getIdToken } from "firebase/auth";
import { ArrowLeftRight, Calendar, ClipboardCheck, Mic, Sparkles, UserRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { normalizeVideoUrl } from "@/lib/video-url";
import type { Player } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ComparisonNote = {
  id: string;
  playerId: string;
  coachId: string;
  beforeAnalysisId: string;
  afterAnalysisId: string;
  comment: string;
  createdAt?: any;
  beforeLabel?: string;
  afterLabel?: string;
};

export default function CoachComparePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [beforeAnalysisId, setBeforeAnalysisId] = useState<string>("");
  const [afterAnalysisId, setAfterAnalysisId] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [comparisonNotes, setComparisonNotes] = useState<ComparisonNote[]>([]);
  const [comparisonAnalyses, setComparisonAnalyses] = useState<Record<string, any>>({});
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [recordingError, setRecordingError] = useState("");
  const recognitionRef = useRef<any>(null);
  const searchParams = useSearchParams();
  const [focusAnalysisId, setFocusAnalysisId] = useState<string>("");
  const focusAppliedRef = useRef(false);

  const toDate = (value: any) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value?.toDate === "function") return value.toDate();
    if (typeof value?._seconds === "number") {
      return new Date(value._seconds * 1000 + Math.round((value._nanoseconds || 0) / 1e6));
    }
    return null;
  };

  const formatDate = (value: any) => {
    const d = toDate(value);
    return d ? d.toLocaleString() : "Fecha desconocida";
  };

  const getAnalysisLabel = (analysis: any) => {
    const createdAt = formatDate(analysis?.createdAt);
    const shotType = analysis?.shotType ? ` · ${analysis.shotType}` : "";
    return `${createdAt}${shotType}`;
  };

  const getAnalysisVideoUrl = (analysis: any) => {
    const rawUrl =
      analysis?.videoFrontUrl ||
      analysis?.videoUrl ||
      analysis?.videoLeftUrl ||
      analysis?.videoRightUrl ||
      analysis?.videoBackUrl;
    return rawUrl ? (normalizeVideoUrl(String(rawUrl)) ?? undefined) : undefined;
  };

  const getShotTypeLabel = (analysis: any) => analysis?.shotType || "Tiro";

  const beforeAnalysis = useMemo(
    () => analyses.find((a) => a.id === beforeAnalysisId),
    [analyses, beforeAnalysisId]
  );
  const afterAnalysis = useMemo(
    () => analyses.find((a) => a.id === afterAnalysisId),
    [analyses, afterAnalysisId]
  );

  useEffect(() => {
    if (!user) return;
    const unsubs: Array<() => void> = [];
    try {
      const q1 = query(collection(db as any, "players"), where("coachId", "==", user.uid));
      const q2 = query(collection(db as any, "players"), where("coachDocId", "==", user.uid));
      const apply = (snap: any) => {
        setPlayers((prev) => {
          const incoming = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as any[];
          const merged = [...prev, ...incoming].reduce((acc: Record<string, Player>, p: any) => {
            if (p?.id) acc[p.id] = p;
            return acc;
          }, {} as Record<string, Player>);
          return Object.values(merged) as Player[];
        });
      };
      unsubs.push(onSnapshot(q1, apply));
      unsubs.push(onSnapshot(q2, apply));
    } catch (e) {
      console.error("Error cargando jugadores del coach:", e);
    }
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedPlayerId) {
      setAnalyses([]);
      return;
    }
    const q = query(
      collection(db as any, "analyses"),
      where("playerId", "==", selectedPlayerId),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const filtered = list.filter((analysis: any) => {
          const access = analysis?.coachAccess?.[user.uid];
          if (analysis?.coachId === user.uid) return true;
          if (access?.status === "paid") return true;
          return false;
        });
        setAnalyses(filtered);
      },
      (err) => {
        console.error("Error cargando análisis:", err);
      }
    );
    return () => unsub();
  }, [user, selectedPlayerId]);

  useEffect(() => {
    const ids = new Set<string>();
    comparisonNotes.forEach((note) => {
      if (note.beforeAnalysisId) ids.add(note.beforeAnalysisId);
      if (note.afterAnalysisId) ids.add(note.afterAnalysisId);
    });
    const missing = Array.from(ids).filter((id) => !comparisonAnalyses[id]);
    if (missing.length === 0) return;
    const load = async () => {
      try {
        const entries = await Promise.all(
          missing.map(async (id) => {
            const snap = await getDoc(doc(db as any, "analyses", id));
            return [id, snap.exists() ? { id, ...(snap.data() as any) } : null] as const;
          })
        );
        setComparisonAnalyses((prev) => {
          const next = { ...prev };
          entries.forEach(([id, data]) => {
            if (data) next[id] = data;
          });
          return next;
        });
      } catch (e) {
        console.error("Error cargando análisis de comparación:", e);
      }
    };
    load();
  }, [comparisonNotes, comparisonAnalyses]);

  useEffect(() => {
    setBeforeAnalysisId("");
    setAfterAnalysisId("");
    setComment("");
  }, [selectedPlayerId]);

  useEffect(() => {
    const playerIdParam = searchParams?.get("playerId") || "";
    const focusParam = searchParams?.get("focusAnalysisId") || "";
    if (playerIdParam && !selectedPlayerId) {
      setSelectedPlayerId(playerIdParam);
    }
    if (focusParam) {
      setFocusAnalysisId(focusParam);
    }
  }, [searchParams, selectedPlayerId]);

  useEffect(() => {
    if (!user || !selectedPlayerId) {
      setComparisonNotes([]);
      return;
    }
    const q = query(
      collection(db as any, "comparisonNotes"),
      where("playerId", "==", selectedPlayerId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ComparisonNote[];
        list.sort((a, b) => {
          const timeA = toDate(a.createdAt)?.getTime() ?? 0;
          const timeB = toDate(b.createdAt)?.getTime() ?? 0;
          return timeB - timeA;
        });
        setComparisonNotes(list);
      },
      (err) => {
        console.error("Error cargando comparaciones:", err);
      }
    );
    return () => unsub();
  }, [user, selectedPlayerId]);

  useEffect(() => {
    if (!focusAnalysisId || focusAppliedRef.current) return;
    const match = comparisonNotes.find(
      (note) => note.beforeAnalysisId === focusAnalysisId || note.afterAnalysisId === focusAnalysisId
    );
    if (match) {
      setBeforeAnalysisId(match.beforeAnalysisId);
      setAfterAnalysisId(match.afterAnalysisId);
      focusAppliedRef.current = true;
    }
  }, [focusAnalysisId, comparisonNotes]);

  const sortedComparisonNotes = useMemo(() => {
    if (!focusAnalysisId) return comparisonNotes;
    const focused = comparisonNotes.filter(
      (note) => note.beforeAnalysisId === focusAnalysisId || note.afterAnalysisId === focusAnalysisId
    );
    const rest = comparisonNotes.filter(
      (note) => note.beforeAnalysisId !== focusAnalysisId && note.afterAnalysisId !== focusAnalysisId
    );
    return [...focused, ...rest];
  }, [comparisonNotes, focusAnalysisId]);

  const handleSaveComparison = async () => {
    if (!user || !selectedPlayerId) return;
    if (!beforeAnalysisId || !afterAnalysisId) {
      toast({
        title: "Faltan videos",
        description: "Selecciona un video para 'Antes' y otro para 'Después'.",
        variant: "destructive",
      });
      return;
    }
    if (beforeAnalysisId === afterAnalysisId) {
      toast({
        title: "Videos repetidos",
        description: "Elige dos videos distintos para comparar.",
        variant: "destructive",
      });
      return;
    }
    if (!comment.trim()) {
      toast({
        title: "Falta el comentario",
        description: "Escribe al menos una mejora observada.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      await addDoc(collection(db as any, "comparisonNotes"), {
        playerId: selectedPlayerId,
        coachId: user.uid,
        beforeAnalysisId,
        afterAnalysisId,
        comment: comment.trim(),
        createdAt: serverTimestamp(),
        beforeLabel: beforeAnalysis ? getAnalysisLabel(beforeAnalysis) : "",
        afterLabel: afterAnalysis ? getAnalysisLabel(afterAnalysis) : "",
      });
      setComment("");
      toast({
        title: "Comparación guardada",
        description: "La comparación quedó registrada para el jugador.",
      });
    } catch (e) {
      console.error("Error guardando comparación:", e);
      toast({
        title: "Error",
        description: "No se pudo guardar la comparación.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImproveComment = async () => {
    if (!comment.trim()) {
      toast({
        title: "Falta el comentario",
        description: "Escribe un comentario antes de pedir una mejora con IA.",
        variant: "destructive",
      });
      return;
    }
    setAiOpen(true);
    setAiLoading(true);
    setAiSuggestion("");
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      const token = currentUser ? await getIdToken(currentUser, true) : null;
      const response = await fetch("/api/coach/compare/rewrite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: comment }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Error al mejorar el comentario");
      }
      const data = await response.json();
      setAiSuggestion(String(data?.improved || ""));
    } catch (e) {
      console.error("Error mejorando comentario:", e);
      toast({
        title: "Error",
        description: "No se pudo generar una mejora. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const stopRecognition = () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {}
    }
    setIsRecording(false);
    setInterimTranscript("");
    setRecordingError("");
  };

  const startRecognition = async () => {
    if (typeof window === "undefined") return;
    setRecordingError("");

    if (!window.isSecureContext) {
      toast({
        title: "Contexto no seguro",
        description: "El dictado necesita HTTPS o localhost para funcionar.",
        variant: "destructive",
      });
      setRecordingError("Se necesita HTTPS o localhost.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: "No compatible",
        description: "Tu navegador no soporta dictado por voz.",
        variant: "destructive",
      });
      setRecordingError("El navegador no soporta dictado.");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.lang = "es-ES";
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onresult = (event: any) => {
        let finalText = "";
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const transcript = event.results[i][0]?.transcript || "";
          if (event.results[i].isFinal) {
            finalText += transcript;
          } else {
            interimText += transcript;
          }
        }
        if (finalText.trim()) {
          setComment((prev) => {
            const separator = prev.trim().length > 0 ? " " : "";
            return `${prev}${separator}${finalText.trim()}`;
          });
        }
        if (interimText.trim()) {
          setInterimTranscript(interimText.trim());
        }
      };

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onerror = (event: any) => {
        const message = event?.error ? `Error: ${event.error}` : "Error al iniciar el dictado.";
        toast({
          title: "Error de dictado",
          description: message,
          variant: "destructive",
        });
        setRecordingError(message);
        stopRecognition();
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimTranscript("");
      };

      recognitionRef.current = recognition;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      recognitionRef.current.start();
      setInterimTranscript("");
    } catch (e) {
      console.error("Error iniciando reconocimiento:", e);
      toast({
        title: "Error de dictado",
        description: "No se pudo iniciar el dictado. Revisa permisos del micrófono.",
        variant: "destructive",
      });
      setRecordingError("Permiso de micrófono denegado o bloqueado.");
    }
  };

  useEffect(() => {
    return () => {
      stopRecognition();
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-headline text-4xl font-bold tracking-tight">Comparación Antes / Después</h1>
            <p className="mt-2 text-muted-foreground">
              Selecciona dos videos del mismo jugador para mostrar mejoras y dejar comentarios.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/coach/dashboard">Volver al panel</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5" />
            Elegir jugador
          </CardTitle>
          <CardDescription>Solo se muestran jugadores vinculados a tu cuenta.</CardDescription>
        </CardHeader>
        <CardContent className="max-w-xl">
          <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un jugador" />
            </SelectTrigger>
            <SelectContent>
              {players.length === 0 && (
                <SelectItem value="no-players" disabled>
                  No hay jugadores vinculados
                </SelectItem>
              )}
              {players.map((player) => (
                <SelectItem key={player.id} value={player.id}>
                  {player.displayName || player.name || player.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Selección de videos
          </CardTitle>
          <CardDescription>Selecciona el antes y el después del mismo jugador.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Antes</div>
            <Select value={beforeAnalysisId} onValueChange={setBeforeAnalysisId} disabled={!selectedPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí el video inicial" />
              </SelectTrigger>
              <SelectContent>
                {analyses.length === 0 && (
                  <SelectItem value="no-analyses" disabled>
                    No hay análisis disponibles
                  </SelectItem>
                )}
                {analyses.map((analysis) => (
                  <SelectItem key={analysis.id} value={analysis.id}>
                    {getAnalysisLabel(analysis)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Después</div>
            <Select value={afterAnalysisId} onValueChange={setAfterAnalysisId} disabled={!selectedPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí el video más reciente" />
              </SelectTrigger>
              <SelectContent>
                {analyses.length === 0 && (
                  <SelectItem value="no-analyses" disabled>
                    No hay análisis disponibles
                  </SelectItem>
                )}
                {analyses.map((analysis) => (
                  <SelectItem key={analysis.id} value={analysis.id}>
                    {getAnalysisLabel(analysis)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Video Antes
            </CardTitle>
            <CardDescription>{beforeAnalysis ? getAnalysisLabel(beforeAnalysis) : "Sin selección"}</CardDescription>
          </CardHeader>
          <CardContent>
            {beforeAnalysis && getAnalysisVideoUrl(beforeAnalysis) ? (
              <video
                controls
                className="w-full rounded-lg border bg-black aspect-video"
                src={getAnalysisVideoUrl(beforeAnalysis)}
              />
            ) : (
              <div className="text-sm text-muted-foreground">Selecciona un análisis para ver el video.</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Video Después
            </CardTitle>
            <CardDescription>{afterAnalysis ? getAnalysisLabel(afterAnalysis) : "Sin selección"}</CardDescription>
          </CardHeader>
          <CardContent>
            {afterAnalysis && getAnalysisVideoUrl(afterAnalysis) ? (
              <video
                controls
                className="w-full rounded-lg border bg-black aspect-video"
                src={getAnalysisVideoUrl(afterAnalysis)}
              />
            ) : (
              <div className="text-sm text-muted-foreground">Selecciona un análisis para ver el video.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Comentarios sobre mejoras
          </CardTitle>
          <CardDescription>
            Deja por escrito los cambios técnicos observados para que el jugador vea su progreso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ej: Mejoró la alineación de codos y la extensión final en el release."
            rows={4}
          />
          <div className="flex items-center gap-2">
            <Button onClick={handleSaveComparison} disabled={isSaving || !selectedPlayerId}>
              {isSaving ? "Guardando..." : "Guardar comparación"}
            </Button>
            <Button
              variant={isRecording ? "destructive" : "outline"}
              onClick={isRecording ? stopRecognition : startRecognition}
              disabled={isSaving}
            >
              <Mic className="mr-2 h-4 w-4" />
              {isRecording ? "Detener dictado" : "Dictar comentario"}
            </Button>
            <Button
              variant="secondary"
              onClick={handleImproveComment}
              disabled={isSaving}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Mejorar con IA
            </Button>
            <Button
              variant="outline"
              onClick={() => setComment("")}
              disabled={isSaving || !comment}
            >
              Limpiar comentario
            </Button>
          </div>
          {isRecording && (
            <div className="text-xs text-muted-foreground">
              Dictando... {interimTranscript ? `"${interimTranscript}"` : "escuchando"}
            </div>
          )}
          {!!recordingError && (
            <div className="text-xs text-destructive">{recordingError}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comparaciones guardadas</CardTitle>
          <CardDescription>Historial del jugador seleccionado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {comparisonNotes.length === 0 && (
            <div className="text-sm text-muted-foreground">Todavía no hay comparaciones guardadas.</div>
          )}
          <Accordion
            type="single"
            collapsible
            defaultValue={
              sortedComparisonNotes.find(
                (note) =>
                  focusAnalysisId &&
                  (note.beforeAnalysisId === focusAnalysisId || note.afterAnalysisId === focusAnalysisId)
              )?.id
            }
            className="space-y-2"
          >
            {sortedComparisonNotes.map((note) => {
              const isFocused =
                focusAnalysisId &&
                (note.beforeAnalysisId === focusAnalysisId || note.afterAnalysisId === focusAnalysisId);
              const before = comparisonAnalyses[note.beforeAnalysisId];
              const after = comparisonAnalyses[note.afterAnalysisId];
              const shotType = getShotTypeLabel(after || before);
              const beforeDate = formatDate(before?.createdAt);
              const afterDate = formatDate(after?.createdAt);
              return (
                <AccordionItem
                  key={note.id}
                  value={note.id}
                  className={`rounded-lg border px-4 ${isFocused ? "ring-2 ring-primary/40" : ""}`}
                >
                  <AccordionTrigger className="text-left">
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Comparación realizada</span>
                      <span>· {shotType}</span>
                      <span>· {beforeDate} → {afterDate}</span>
                      <span>· Tiros evaluados: 2</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pb-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Video Antes</div>
                        {getAnalysisVideoUrl(before) ? (
                          <video
                            controls
                            className="w-full rounded-md border bg-black aspect-video"
                            src={getAnalysisVideoUrl(before)}
                          />
                        ) : (
                          <div className="text-xs text-muted-foreground">Video no disponible.</div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Video Después</div>
                        {getAnalysisVideoUrl(after) ? (
                          <video
                            controls
                            className="w-full rounded-md border bg-black aspect-video"
                            src={getAnalysisVideoUrl(after)}
                          />
                        ) : (
                          <div className="text-xs text-muted-foreground">Video no disponible.</div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm">{note.comment}</div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mejorar redacción con IA</DialogTitle>
            <DialogDescription>
              Revisá la versión propuesta y ajustá lo que necesites antes de aplicarla.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground">Propuesta</div>
            <Textarea
              value={aiSuggestion}
              onChange={(e) => setAiSuggestion(e.target.value)}
              placeholder={aiLoading ? "Generando propuesta..." : "La propuesta aparecerá aquí"}
              rows={6}
              disabled={aiLoading}
            />
          </div>
          <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
            <Button variant="outline" onClick={handleImproveComment} disabled={aiLoading}>
              {aiLoading ? "Generando..." : "Reintentar"}
            </Button>
            <Button
              onClick={() => {
                if (aiSuggestion.trim()) {
                  setComment(aiSuggestion.trim());
                  setAiOpen(false);
                } else {
                  toast({
                    title: "No hay propuesta",
                    description: "Genera una propuesta antes de aplicar.",
                    variant: "destructive",
                  });
                }
              }}
              disabled={aiLoading}
            >
              Usar esta versión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
