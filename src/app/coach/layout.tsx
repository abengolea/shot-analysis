"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (loading) return;
      // No autenticado: enviar a login
      if (!user) {
        window.location.href = "/login";
        return;
      }
      try {
        const snap = await getDoc(doc(db as any, "coaches", user.uid));
        if (!snap.exists()) {
          // No es coach: invitar a registrarse como entrenador
          window.location.href = "/coach-register";
          return;
        }
        setAllowed(true);
      } catch {
        // Si falla la verificación, llevar a registro por seguridad
        window.location.href = "/coach-register";
        return;
      } finally {
        setChecking(false);
      }
    };
    run();
  }, [user, loading]);

  if (loading || checking) {
    return <div className="min-h-screen flex items-center justify-center">Cargando…</div>;
  }

  if (!allowed) return null;

  return <>{children}</>;
}


