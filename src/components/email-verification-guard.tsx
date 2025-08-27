"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, CheckCircle } from 'lucide-react';

interface EmailVerificationGuardProps {
  children: React.ReactNode;
}

export function EmailVerificationGuard({ children }: EmailVerificationGuardProps) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && !user.emailVerified) {
      // Si el usuario no está verificado, redirigir a la página de verificación
      router.push('/verify-email');
    }
  }, [user, loading, router]);

  // Si está cargando, mostrar nada
  if (loading) {
    return null;
  }

  // Si no hay usuario, mostrar nada (será manejado por AuthGuard)
  if (!user) {
    return null;
  }

  // Si el email no está verificado, mostrar mensaje de verificación
  if (!user.emailVerified) {
    return (
      <div className="container mx-auto p-6 max-w-md">
        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Verifica tu Email</CardTitle>
            <CardDescription>
              Para acceder a esta página, necesitas verificar tu dirección de email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-blue-50 p-4">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">Revisa tu bandeja de entrada</p>
                  <p className="mt-1">Te hemos enviado un email con un enlace de verificación</p>
                </div>
              </div>
            </div>
            
            <Button 
              onClick={() => router.push('/verify-email')} 
              className="w-full"
            >
              Ir a Verificación de Email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Si el email está verificado, mostrar el contenido
  return <>{children}</>;
}
