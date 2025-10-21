"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminLoginPage() {
  const { user, userProfile, signIn, loading, signOutUser, resetPassword } = useAuth();
  const [email, setEmail] = useState(process.env.NODE_ENV !== 'production' ? "abengolea@hotmail.com" : "");
  const [password, setPassword] = useState(process.env.NODE_ENV !== 'production' ? "afdlue4333379832" : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (loading) return;
    const role = (userProfile as any)?.role;
    if (user && role === 'admin') {
      window.location.href = "/admin";
    }
  }, [user, userProfile, loading]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await signIn(email, password);
      if (!res.success) {
        setError(res.message || 'Error de autenticación');
        return;
      }
      // No redirigimos aquí; esperamos a que cargue userProfile con rol admin en el useEffect
    } catch (e: any) {
      setError(e?.message || 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm border rounded-md p-6 space-y-4">
        <h1 className="text-xl font-semibold text-center">Acceso de Administrador</h1>
        {user && (userProfile as any)?.role !== 'admin' && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            Estás autenticado, pero esta cuenta no tiene rol admin. Cierra sesión e ingresa con la cuenta de administrador.
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={() => { try { void signOutUser(); } catch {} }}>Cerrar sesión</Button>
            </div>
          </div>
        )}
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-sm">Email</label>
            <Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="admin@tu-dominio.com" required />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Contraseña</label>
            <div className="relative">
              <Input type={showPassword ? "text" : "password"} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" required />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={() => setShowPassword((v)=>!v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-end -mt-1">
            <button
              type="button"
              className="text-xs text-primary underline disabled:opacity-50"
              onClick={async () => {
                if (!email) {
                  toast({ title: 'Ingresa tu email', description: 'Escribe tu email para enviarte el enlace de recuperación.', variant: 'destructive' });
                  return;
                }
                setResetting(true);
                try {
                  const res = await resetPassword(email);
                  if (res.success) {
                    toast({ title: 'Revisa tu correo', description: 'Te enviamos un enlace para restablecer tu contraseña.' });
                  } else {
                    toast({ title: 'No se pudo enviar', description: res.message, variant: 'destructive' });
                  }
                } finally {
                  setResetting(false);
                }
              }}
              disabled={resetting}
            >
              {resetting ? 'Enviando…' : '¿Olvidaste tu contraseña?'}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>{submitting? 'Ingresando…' : 'Ingresar'}</Button>
        </form>
      </div>
    </div>
  );
}

