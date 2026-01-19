'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, MessageSquare, Gift, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

type SearchParams = { [key: string]: string | string[] | undefined };

function getParam(params: SearchParams, key: string): string | undefined {
  const v = params[key];
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}

export default function PaymentsReturnPage({ searchParams }: { searchParams: SearchParams }) {
  const [isFromDlocal, setIsFromDlocal] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState<boolean | null>(null);
  const mpProcessingRef = useRef(false);
  const dlocalProcessingRef = useRef(false);
  const revalidateRef = useRef(false);
  const redirectRef = useRef(false);
  const [revalidatingCoach, setRevalidatingCoach] = useState(false);
  const [revalidatedCoach, setRevalidatedCoach] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  // Parámetros de MercadoPago
  const status = (getParam(searchParams, 'status') || '').toLowerCase();
  const collectionStatus = (getParam(searchParams, 'collection_status') || '').toLowerCase();
  const preferenceId = getParam(searchParams, 'preference_id') || getParam(searchParams, 'preferenceId');
  const paymentId = getParam(searchParams, 'payment_id');
  const merchantOrderId = getParam(searchParams, 'merchant_order_id');

  // Parámetros de dLocal Go
  const dlocalStatus = getParam(searchParams, 'status') || getParam(searchParams, 'payment_status');
  const dlocalPaymentId = getParam(searchParams, 'payment_id') || getParam(searchParams, 'id');
  const dlocalOrderId = getParam(searchParams, 'order_id');
  const provider = getParam(searchParams, 'provider');
  const isDlocal = !!dlocalPaymentId || !!dlocalOrderId || provider === 'dlocal';
  const isMercadoPago = provider === 'mercadopago' || (!isDlocal && (preferenceId || paymentId));

  // Si viene de dLocal Go y no hay parámetros de estado, asumir que el pago fue exitoso
  // (porque dLocal redirige solo después de pago exitoso)
  const dlocalApproved = (isDlocal || isFromDlocal) && (
    dlocalStatus?.toLowerCase() === 'paid' || 
    dlocalStatus?.toLowerCase() === 'approved' || 
    status === 'paid' || 
    status === 'approved' ||
    (!dlocalStatus && !status && !collectionStatus && isFromDlocal) // Si viene de dLocal y no hay parámetros, asumir éxito
  );
  
  // Si viene de dLocal, considerar que es dLocal
  const finalIsDlocal = isDlocal || isFromDlocal;

  // Determinar estado del pago
  const approved = finalIsDlocal
    ? dlocalApproved
    : (status === 'approved' || collectionStatus === 'approved');
  const pending = finalIsDlocal
    ? (dlocalStatus?.toLowerCase() === 'pending' || status === 'pending')
    : (status === 'pending' || collectionStatus === 'pending');
  const failure = !approved && !pending;

  // Verificar si es un pago de coach_review
  // Si viene de dLocal Go y no hay parámetros específicos, asumir que puede ser coach_review
  // (porque la mayoría de los pagos con dLocal son coach_review)
  const productId = getParam(searchParams, 'productId');
  const coachId = getParam(searchParams, 'coachId');
  const analysisId = getParam(searchParams, 'analysisId');
  const isCoachReview = productId === 'coach_review' || 
                         getParam(searchParams, 'type') === 'coach_review' ||
                         !!coachId || 
                         !!analysisId ||
                         (finalIsDlocal && !productId); // Si es dLocal y no hay productId, probablemente es coach_review

  useEffect(() => {
    // Detectar si viene de dLocal Go revisando el referrer
    if (typeof window !== 'undefined') {
      const referrer = document.referrer;
      if (referrer.includes('dlocalgo.com') || referrer.includes('checkout.dlocalgo.com')) {
        setIsFromDlocal(true);
      }
    }
  }, []);

  // Para MercadoPago: si viene aprobado, forzar procesamiento por backend
  // (sirve cuando el webhook no llega o tarda).
  useEffect(() => {
    const processMercadoPago = async () => {
      if (mpProcessingRef.current) return;
      mpProcessingRef.current = true;
      try {
        if (!user) return;
        const token = await user.getIdToken();
        const response = await fetch('/api/payments/check-mp-payment', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentId,
            preferenceId,
            analysisId,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.success) {
            setPaymentVerified(true);
          }
        }
      } catch (error) {
        console.error('Error procesando pago MP:', error);
      }
    };

    if (approved && isCoachReview && isMercadoPago && (paymentId || preferenceId) && user) {
      processMercadoPago();
    }
  }, [approved, isCoachReview, isMercadoPago, paymentId, preferenceId, analysisId, user]);

  // Para dLocal: forzar procesamiento por backend al volver del checkout
  useEffect(() => {
    const processDlocal = async () => {
      if (dlocalProcessingRef.current) return;
      dlocalProcessingRef.current = true;
      try {
        if (!user) return;
        const token = await user.getIdToken();
        const response = await fetch('/api/payments/check-dlocal-payment', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentId: dlocalPaymentId,
            orderId: dlocalOrderId,
            analysisId,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.success) {
            setPaymentVerified(true);
          }
        }
      } catch (error) {
        console.error('Error procesando pago dLocal:', error);
      }
    };

    if (approved && isCoachReview && finalIsDlocal && (dlocalPaymentId || dlocalOrderId) && user) {
      processDlocal();
    }
  }, [approved, isCoachReview, finalIsDlocal, dlocalPaymentId, dlocalOrderId, analysisId, user]);

  // Forzar revalidación del panel del entrenador luego del retorno
  useEffect(() => {
    const revalidateCoachPanel = async () => {
      if (revalidateRef.current) return;
      revalidateRef.current = true;
      setRevalidatingCoach(true);
      try {
        if (!user || !analysisId) return;
        const token = await user.getIdToken();
        const response = await fetch('/api/revalidate/coach-access', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ analysisId, coachId }),
        });
        if (response.ok) {
          setRevalidatedCoach(true);
        }
      } catch (error) {
        console.error('Error revalidando panel del coach:', error);
      } finally {
        setRevalidatingCoach(false);
      }
    };

    if (approved && isCoachReview && analysisId && user) {
      revalidateCoachPanel();
    }
  }, [approved, isCoachReview, analysisId, coachId, user]);

  // Redirección automática al análisis cuando ya está actualizado
  useEffect(() => {
    if (!approved || !isCoachReview || !analysisId) return;
    if (redirectRef.current || !revalidatedCoach) return;
    redirectRef.current = true;
    setRedirecting(true);
    const timer = setTimeout(() => {
      router.push(`/analysis/${analysisId}`);
    }, 1500);
    return () => clearTimeout(timer);
  }, [approved, isCoachReview, analysisId, revalidatedCoach, router]);

  // Verificar si el pago ya fue procesado por el webhook (solo para coach_review)
  useEffect(() => {
    const verifyPaymentStatus = async () => {
      const productId = getParam(searchParams, 'productId');
      const coachId = getParam(searchParams, 'coachId');
      const analysisId = getParam(searchParams, 'analysisId');
      const isCoachReview = productId === 'coach_review' || !!coachId || !!analysisId;
      
      // Solo verificar si es un pago de coach_review y está aprobado
      if (!isCoachReview || !approved || !analysisId || !coachId || !user) {
        return;
      }

      setVerifyingPayment(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/analyses/${analysisId}/unlock-status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          const paidCoachIds = data.paidCoachIds || [];
          const isPaid = paidCoachIds.some((c: any) => c.coachId === coachId);
          setPaymentVerified(isPaid);
        } else {
          setPaymentVerified(false);
        }
      } catch (error) {
        console.error('Error verificando estado del pago:', error);
        setPaymentVerified(false);
      } finally {
        setVerifyingPayment(false);
      }
    };

    if (approved) {
      // Esperar un poco para dar tiempo al webhook de procesar
      const timer = setTimeout(() => {
        verifyPaymentStatus();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [approved, searchParams, user]);
  const title = approved
    ? '¡Pago completado exitosamente!'
    : pending
      ? 'Pago pendiente'
      : 'Pago no aprobado';

  const desc = approved && isCoachReview
    ? 'Tu pago fue procesado correctamente. El entrenador recibió una notificación y pronto te dejará su devolución.'
    : approved
      ? 'Gracias. Acreditaremos tus créditos en breve. Puedes volver a la app.'
      : pending
        ? finalIsDlocal
          ? 'dLocal Go está procesando tu pago. Se acreditará automáticamente cuando se apruebe.'
          : isMercadoPago
            ? 'Mercado Pago está procesando tu pago. Se acreditará automáticamente cuando se apruebe.'
            : 'El pago está siendo procesado. Se acreditará automáticamente cuando se apruebe.'
        : 'Tu pago no se aprobó o fue cancelado. Puedes intentar nuevamente.';
  
  // Mensaje adicional para MercadoPago si no redirigió automáticamente
  const showManualReturnMessage = isMercadoPago && approved && !pending;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="text-center mb-8">
        {approved ? (
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
          </div>
        ) : null}
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-lg text-muted-foreground">{desc}</p>
      </div>

      {approved && isCoachReview && (
        <div className="rounded-lg border-2 border-green-200 bg-green-50 p-6 mb-6 space-y-4">
          {verifyingPayment ? (
            <div className="flex items-center gap-3 text-green-800">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm">Verificando que el pago se procesó correctamente...</p>
            </div>
          ) : paymentVerified === true ? (
            <>
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-900 mb-1">✅ Pago procesado y acceso habilitado</h3>
                  <p className="text-sm text-green-800">
                    El entrenador ya recibió la notificación y tiene acceso a tu análisis. Podrá ver tus videos y dejar su devolución.
                  </p>
                </div>
              </div>
              {(revalidatingCoach || revalidatedCoach) && (
                <div className="rounded-md border border-green-200 bg-green-100/60 px-4 py-3 text-sm text-green-900">
                  {revalidatingCoach ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Actualizando el estado del entrenador en el panel...</span>
                    </div>
                  ) : (
                    <span>✅ Estado actualizado en el panel del entrenador y en tu análisis.</span>
                  )}
                </div>
              )}
              {redirecting && (
                <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Redirigiendo al análisis...</span>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-3 pt-3 border-t border-green-200">
                <Gift className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-900 mb-1">🎁 ¡Bonus adicional!</h3>
                  <p className="text-sm text-green-800">
                    Como agradecimiento, te regalamos <strong>2 análisis gratis adicionales con IA</strong> que ya están disponibles en tu cuenta.
                  </p>
                </div>
              </div>
            </>
          ) : paymentVerified === false ? (
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">⏳ Pago en procesamiento</h3>
                <p className="text-sm text-yellow-800">
                  Tu pago fue aprobado pero aún se está procesando. El entrenador recibirá acceso en breve. Si el problema persiste, contacta a soporte.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-900 mb-1">✅ Mensaje enviado al entrenador</h3>
                  <p className="text-sm text-green-800">
                    El entrenador recibió una notificación y podrá ver tu análisis. Te avisaremos cuando deje su devolución.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 pt-3 border-t border-green-200">
                <Gift className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-900 mb-1">🎁 ¡Bonus adicional!</h3>
                  <p className="text-sm text-green-800">
                    Como agradecimiento, te regalamos <strong>2 análisis gratis adicionales con IA</strong> que ya están disponibles en tu cuenta.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {finalIsDlocal && approved && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>✅ Pago procesado:</strong> Tu pago fue completado exitosamente. Puedes cerrar esta ventana y volver a la aplicación. 
            El entrenador ya recibió la notificación y los 2 análisis gratis ya están en tu cuenta.
          </p>
        </div>
      )}

      {showManualReturnMessage && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 mb-6">
          <p className="text-sm text-amber-800">
            <strong>💡 Nota importante:</strong> Si MercadoPago no te redirigió automáticamente, es normal. 
            El pago ya fue procesado correctamente. Puedes cerrar la ventana de MercadoPago y volver a la aplicación.
            El entrenador recibirá la notificación y los 2 análisis gratis ya están en tu cuenta.
          </p>
        </div>
      )}

      <div className="rounded-md border bg-muted/40 p-4 text-sm space-y-2 mb-6">
        <h3 className="font-semibold mb-2">Detalles del pago:</h3>
        {finalIsDlocal ? (
          <>
            {dlocalPaymentId ? (<div><span className="font-medium">ID de pago:</span> {dlocalPaymentId}</div>) : null}
            {dlocalOrderId ? (<div><span className="font-medium">ID de orden:</span> {dlocalOrderId}</div>) : null}
            {dlocalStatus ? (<div><span className="font-medium">Estado:</span> {dlocalStatus}</div>) : null}
          </>
        ) : (
          <>
            {paymentId ? (<div><span className="font-medium">payment_id:</span> {paymentId}</div>) : null}
            {preferenceId ? (<div><span className="font-medium">preference_id:</span> {preferenceId}</div>) : null}
            {merchantOrderId ? (<div><span className="font-medium">merchant_order_id:</span> {merchantOrderId}</div>) : null}
            {status ? (<div><span className="font-medium">status:</span> {status}</div>) : null}
            {collectionStatus ? (<div><span className="font-medium">collection_status:</span> {collectionStatus}</div>) : null}
          </>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link 
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-white text-sm font-medium hover:bg-primary/90 transition-colors" 
          href="/player/dashboard"
        >
          Volver al panel
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
        {isCoachReview ? (
          <Link 
            className="inline-flex items-center justify-center rounded-md border px-6 py-3 text-sm font-medium hover:bg-accent transition-colors" 
            href="/player/messages"
          >
            Ver mensajes
          </Link>
        ) : (
          <Link 
            className="inline-flex items-center justify-center rounded-md border px-6 py-3 text-sm font-medium hover:bg-accent transition-colors" 
            href="/upload"
          >
            Cargar análisis
          </Link>
        )}
      </div>
    </div>
  );
}

