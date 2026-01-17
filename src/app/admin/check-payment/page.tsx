"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CheckPaymentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [analysisId, setAnalysisId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [preferenceId, setPreferenceId] = useState("");
  const [provider, setProvider] = useState<"mercadopago" | "dlocal">("mercadopago");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [checkingUnlock, setCheckingUnlock] = useState(false);
  const [unlockStatus, setUnlockStatus] = useState<any>(null);

  const checkPayment = async () => {
    if (!paymentId && (provider === "mercadopago" && !preferenceId)) {
      toast({
        title: "Error",
        description: provider === "mercadopago"
          ? "Por favor ingresa un payment ID o preference ID"
          : "Por favor ingresa un payment ID",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "Debes estar autenticado",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const token = await user.getIdToken();
      const endpoint = provider === "dlocal"
        ? "/api/payments/check-dlocal-payment"
        : "/api/payments/check-mp-payment";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentId: paymentId || undefined,
          preferenceId: provider === "mercadopago" ? (preferenceId || undefined) : undefined,
          analysisId: analysisId || undefined,
        }),
      });

      const data = await response.json();
      setResult({ success: response.ok, data, status: response.status });
      
      if (response.ok && data.success) {
        toast({
          title: "Éxito",
          description: "Pago procesado correctamente",
          variant: "default",
        });
        // Recargar estado del unlock si hay analysisId
        if (analysisId) {
          checkUnlockStatus();
        }
      } else {
        toast({
          title: "Error",
          description: data.error || data.message || "Error al verificar el pago",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message });
      toast({
        title: "Error",
        description: error.message || "Error al verificar el pago",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkUnlockStatus = async () => {
    if (!analysisId || !user) return;

    setCheckingUnlock(true);
    setUnlockStatus(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/analyses/${analysisId}/unlock-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUnlockStatus(data);
      }
    } catch (error: any) {
      console.error("Error verificando unlock status:", error);
    } finally {
      setCheckingUnlock(false);
    }
  };

  const searchByAnalysisId = async () => {
    if (!analysisId) {
      toast({
        title: "Error",
        description: "Por favor ingresa un Analysis ID",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "Debes estar autenticado",
        variant: "destructive",
      });
      return;
    }

    setCheckingUnlock(true);
    setUnlockStatus(null);
    setResult(null);

    try {
      const token = await user.getIdToken();
      
      // Verificar estado del unlock
      const unlockResponse = await fetch(`/api/analyses/${analysisId}/unlock-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (unlockResponse.ok) {
        const unlockData = await unlockResponse.json();
        setUnlockStatus(unlockData);
        
        // Si hay un unlock con paymentId, intentar verificar ese pago
        if (unlockData.unlocks && unlockData.unlocks.length > 0) {
          const unlock = unlockData.unlocks[0];
          // Buscar paymentId en el unlock o en los coaches pagados
          const foundPaymentId = unlock.paymentId || 
            (unlockData.paidCoachIds && unlockData.paidCoachIds.length > 0 && unlockData.paidCoachIds[0].paymentId
              ? unlockData.paidCoachIds[0].paymentId 
              : null);
          
          // Buscar preferenceId si está disponible
          const foundPreferenceId = unlock.preferenceId;
          
          if (foundPaymentId) {
            setPaymentId(foundPaymentId);
            toast({
              title: "Payment ID encontrado",
              description: `Se encontró payment ID: ${foundPaymentId}. Puedes verificar el pago ahora.`,
            });
          } else if (foundPreferenceId) {
            setPreferenceId(foundPreferenceId);
            toast({
              title: "Preference ID encontrado",
              description: `Se encontró preference ID: ${foundPreferenceId}. Puedes buscar pagos asociados a esta preferencia.`,
            });
          } else if (unlock.status === 'pending' && unlock.paymentProvider === 'mercadopago') {
            // Si está pendiente con MercadoPago, buscar en la colección de payments
            toast({
              title: "Buscando payment ID",
              description: "El unlock está pendiente. Busca el payment ID en la colección 'payments' de Firebase o en el panel de MercadoPago.",
            });
          }
        }
      }
    } catch (error: any) {
      console.error("Error buscando por analysis ID:", error);
      toast({
        title: "Error",
        description: error.message || "Error al buscar el análisis",
        variant: "destructive",
      });
    } finally {
      setCheckingUnlock(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Verificar y Reprocesar Pagos</CardTitle>
          <CardDescription>
            Verifica el estado de un pago (MercadoPago o dLocal) y reprocesa si es necesario
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Búsqueda por Analysis ID */}
          <div className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Proveedor</label>
              <select
                className="rounded border px-2 py-1 text-sm max-w-[220px]"
                value={provider}
                onChange={(e) => setProvider(e.target.value as "mercadopago" | "dlocal")}
              >
                <option value="mercadopago">MercadoPago</option>
                <option value="dlocal">dLocal</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Buscar por Analysis ID
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="analysis_1762087023145_m35dy5ciq"
                  value={analysisId}
                  onChange={(e) => setAnalysisId(e.target.value)}
                />
                <Button
                  onClick={searchByAnalysisId}
                  disabled={checkingUnlock || !analysisId}
                >
                  {checkingUnlock ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    "Buscar"
                  )}
                </Button>
              </div>
            </div>

            {/* Estado del Unlock */}
            {unlockStatus && (
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-lg">Estado del Unlock</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Estado:</span>{" "}
                      <span className={unlockStatus.status === 'paid_pending_review' ? 'text-green-600' : 'text-gray-600'}>
                        {unlockStatus.status}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Tiene feedback:</span>{" "}
                      {unlockStatus.hasCoachFeedback ? (
                        <span className="text-green-600">Sí</span>
                      ) : (
                        <span className="text-gray-600">No</span>
                      )}
                    </div>
                  </div>
                  
                  {unlockStatus.paidCoachIds && unlockStatus.paidCoachIds.length > 0 && (
                    <div>
                      <span className="font-medium text-sm">Coaches pagados:</span>
                      <ul className="list-disc list-inside mt-1 text-sm">
                        {unlockStatus.paidCoachIds.map((c: any) => (
                          <li key={c.coachId}>
                            {c.coachName} ({c.coachId})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {unlockStatus.unlocks && unlockStatus.unlocks.length > 0 && (
                    <div>
                      <span className="font-medium text-sm">Unlocks:</span>
                      <div className="mt-2 space-y-2">
                        {unlockStatus.unlocks.map((u: any) => (
                          <div key={u.id} className="p-2 bg-gray-50 rounded text-sm">
                            <div><strong>ID:</strong> {u.id}</div>
                            <div><strong>Coach:</strong> {u.coachName} ({u.coachId})</div>
                            <div><strong>Estado:</strong> {u.status}</div>
                            {u.paymentId && (
                              <div><strong>Payment ID:</strong> {u.paymentId}</div>
                            )}
                            {u.paymentProvider && (
                              <div><strong>Proveedor:</strong> {u.paymentProvider}</div>
                            )}
                            {u.preferenceId && (
                              <div><strong>Preference ID:</strong> {u.preferenceId}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {unlockStatus.paidCoachIds && unlockStatus.paidCoachIds.length > 0 && unlockStatus.paidCoachIds[0].paymentId && (
                    <div className="mt-2 p-2 bg-green-50 rounded text-sm">
                      <div><strong>Payment ID encontrado:</strong> {unlockStatus.paidCoachIds[0].paymentId}</div>
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setPaymentId(unlockStatus.paidCoachIds[0].paymentId);
                          toast({
                            title: "Payment ID cargado",
                            description: "Puedes verificar el pago ahora",
                          });
                        }}
                      >
                        Usar este Payment ID
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Verificación por Payment ID o Preference ID */}
          <div className="space-y-4 border-t pt-6">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Verificar Payment ID o Preference ID
              </label>
              <div className="flex flex-col gap-2">
                <Input
                  placeholder="1234567890 (Payment ID)"
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                />
                <div className="text-xs text-muted-foreground text-center">o</div>
                <Input
                  placeholder="1234567890-abc123 (Preference ID - MercadoPago)"
                  value={preferenceId}
                  onChange={(e) => setPreferenceId(e.target.value)}
                  disabled={provider !== "mercadopago"}
                />
                <Button
                  onClick={checkPayment}
                  disabled={loading || (!paymentId && (provider === "mercadopago" && !preferenceId))}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Verificar y Reprocesar
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Resultado */}
            {result && (
              <Card className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold mb-2">
                        {result.success ? "Verificación exitosa" : "Error en la verificación"}
                      </h3>
                      <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-96">
                        {JSON.stringify(result.data || result.error, null, 2)}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Instrucciones */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Instrucciones
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>
                <strong>Opción 1 - Buscar por Analysis ID:</strong> Ingresa el ID del análisis y se buscará
                automáticamente el payment ID asociado.
              </p>
              <p>
                <strong>Opción 2 - Verificar Payment ID o Preference ID:</strong> Si conoces el Payment ID (MercadoPago o dLocal),
                o el Preference ID (solo MercadoPago), ingrésalo directamente para verificar y reprocesar el pago.
              </p>
              <p className="text-muted-foreground mt-4">
                Si el pago está aprobado en el proveedor pero no aparece como pagado en el sistema,
                este tool lo reprocesará automáticamente.
              </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

