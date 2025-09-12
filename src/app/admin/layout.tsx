"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading, signOutUser } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    // Permitir cargar la pantalla de login admin sin redirecciones
    if (pathname === "/admin/login") return;
    if (!user) {
      window.location.href = "/admin/login";
      return;
    }
    const role = (userProfile as any)?.role;
    if (role !== "admin") {
      try { void signOutUser(); } catch {}
      window.location.href = "/admin/login";
    }
  }, [user, userProfile, loading, pathname]);

  if (loading) {
    return null;
  }

  // Permitir ver el formulario de login de admin sin bloquear
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (!user || (userProfile as any)?.role !== "admin") {
    return null;
  }

  return <>{children}</>;
}


