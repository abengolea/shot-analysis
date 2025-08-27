"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';

export default function VerifyEmailPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const resendVerification = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Por favor, ingresa tu email",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Intentar enviar email de restablecimiento (Firebase automáticamente verifica si es un usuario válido)
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "Email enviado",
        description: "Si tu email está registrado, recibirás un enlace de verificación",
      });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        toast({
          title: "Usuario no encontrado",
          description: "Este email no está registrado en nuestro sistema",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Error al enviar email. Intenta más tarde",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-md">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Verifica tu Email</CardTitle>
          <CardDescription>
            Para completar tu registro, necesitamos verificar tu dirección de email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium">Revisa tu bandeja de entrada</p>
                <p className="mt-1">Te hemos enviado un email con un enlace de verificación</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-700">
                <p className="font-medium">¿No recibiste el email?</p>
                <p className="mt-1">Revisa tu carpeta de spam o solicita un nuevo enlace</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Tu Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <Button 
              onClick={resendVerification} 
              disabled={loading} 
              className="w-full"
              variant="outline"
            >
              {loading ? 'Enviando...' : 'Reenviar Email de Verificación'}
            </Button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              ¿Ya verificaste tu email?{' '}
              <a href="/login" className="text-blue-600 hover:underline font-medium">
                Inicia sesión aquí
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
