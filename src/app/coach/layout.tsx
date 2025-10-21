"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachStatus, setCoachStatus] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (loading) return;
      setError(null);
      // No autenticado: mostrar aviso en vez de redirigir
      if (!user) {
        setAllowed(false);
        setChecking(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db as any, "coaches", user.uid));
        if (!snap.exists()) {
          // No es coach: mostrar CTA para crear perfil
          setAllowed(false);
          setCoachStatus(null);
        } else {
          const data = snap.data() as any;
          const status = String(data?.status || 'pending');
          setCoachStatus(status);
          setAllowed(status === 'active');
        }
      } catch (e) {
        // Si falla la verificación, no redirigir: mostrar mensaje de error
        setAllowed(false);
        setError("No se pudo verificar tu perfil de entrenador. Intenta nuevamente.");
      } finally {
        setChecking(false);
      }
    };
    run();
  }, [user, loading]);

  if (loading || checking) {
    return <div className="min-h-screen flex items-center justify-center">Cargando…</div>;
  }

  if (allowed) {
    return <>{children}</>;
  }

  // Estados no permitidos: mostrar UI en vez de redirigir
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Necesitas iniciar sesión</h1>
          <p className="text-muted-foreground">Para acceder al panel de entrenador debes iniciar sesión.</p>
          <div className="flex items-center justify-center gap-3">
            <Button asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Ir al inicio</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg text-center space-y-4">
          <h1 className="text-2xl font-bold">No pudimos cargar tu perfil de entrenador</h1>
          <p className="text-muted-foreground">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => { setChecking(true); /* reintento */ }}>Reintentar</Button>
            <Button variant="outline" asChild>
              <Link href="/coach-register">Crear perfil de entrenador</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Usuario autenticado pero sin perfil de coach
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg text-center space-y-4">
        {coachStatus && coachStatus !== 'active' ? (
          <>
            <h1 className="text-2xl font-bold">Tu cuenta de entrenador está pendiente</h1>
            <p className="text-muted-foreground">Mientras se aprueba, solo podrás actualizar tu perfil.</p>
            <div className="flex items-center justify-center gap-3">
              <Button asChild>
                <Link href="/player/profile">Ir a mi perfil</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Ir al inicio</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Aún no tienes perfil de entrenador</h1>
            <p className="text-muted-foreground">
              Para usar el panel de entrenador, primero crea tu perfil. Esto toma menos de 2 minutos.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button asChild>
                <Link href="/coach-register">Crear mi perfil de entrenador</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard">Ir a mi panel de jugador</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );

}

