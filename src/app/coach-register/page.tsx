"use client";

import { CoachAdminForm } from "@/components/coach-admin-form";
import { BasketballIcon } from "@/components/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Star, Users, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { storage } from "@/lib/firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useState } from "react";

const benefits = [
  {
    icon: <Users className="h-6 w-6" />,
    title: "Acceso a Jugadores",
    description: "Conecta con jugadores que buscan mejorar su técnica"
  },
  {
    icon: <Star className="h-6 w-6" />,
    title: "Construye tu Reputación",
    description: "Recibe reseñas y construye tu marca personal"
  },
  {
    icon: <Award className="h-6 w-6" />,
    title: "Gana Dinero",
    description: "Establece tus tarifas y monetiza tu experiencia"
  }
];

export default function CoachRegisterPage() {
  const { user, userProfile } = useAuth();
  const [name, setName] = useState<string>(user?.displayName || (userProfile as any)?.name || "");
  const [email, setEmail] = useState<string>(user?.email || "");
  const [bio, setBio] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    if (!file) { setPhotoFile(null); return; }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (!allowed.includes(file.type)) {
      alert('Tipo de archivo no permitido. Usa JPG, PNG o WEBP.');
      e.currentTarget.value = '';
      return;
    }
    if (file.size > maxBytes) {
      alert('La imagen supera 5MB. Reduce el tamaño e intenta de nuevo.');
      e.currentTarget.value = '';
      return;
    }
    setPhotoFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!user) {
        window.location.href = '/login';
        return;
      }
      if (!email) { alert('Email es requerido'); return; }
      if (!name) { alert('Nombre es requerido'); return; }
      if (!photoFile) { alert('Debes subir una foto'); return; }

      setSubmitting(true);

      // Subir foto a Storage en una ruta interna
      const safeName = (photoFile.name || 'photo').replace(/[^a-zA-Z0-9_.-]/g, '_');
      const filePath = `profile-images/${user.uid}/${Date.now()}-${safeName}`;
      const fileRef = ref(storage, filePath);
      await uploadBytes(fileRef, photoFile, { contentType: photoFile.type });
      const photoUrl = await getDownloadURL(fileRef);

      // Llamar API para crear la solicitud
      const token = await user.getIdToken();
      const res = await fetch('/api/coach-applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, bio, photoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Error al enviar la solicitud');
      }

      alert('Solicitud enviada. Un administrador revisará tu alta como entrenador.');
      setBio('');
      setPhotoFile(null);
    } catch (err: any) {
      console.error('Error enviando solicitud de entrenador:', err);
      alert(err?.message || 'No se pudo enviar la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = (userProfile as any)?.role === 'admin';

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <BasketballIcon className="h-16 w-16 text-primary" />
        </div>
        <h1 className="font-headline text-4xl font-bold tracking-tight mb-4">
          Únete como Entrenador
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Conecta con jugadores, comparte tu experiencia y construye tu negocio 
          en la plataforma líder de análisis de baloncesto con IA.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Formulario de Registro */}
        <div>
          {isAdmin ? (
            <CoachAdminForm />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Registro Rápido</CardTitle>
                <CardDescription>
                  Completa tus datos y envía la solicitud. Un administrador aprobará tu alta.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre completo</Label>
                    <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Tu nombre" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio corta (opcional)</Label>
                    <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Experiencia, enfoque, logros" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="photo">Foto de perfil (JPG/PNG/WEBP, máx 5MB)</Label>
                    <Input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? 'Enviando...' : 'Enviar solicitud'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Beneficios y Información */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                ¿Por qué unirte como Entrenador?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg text-primary">
                    {benefit.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold">{benefit.title}</h4>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proceso Simple</CardTitle>
              <CardDescription>
                En solo 3 pasos estarás listo para empezar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="h-8 w-8 rounded-full p-0 flex items-center justify-center">
                  1
                </Badge>
                <span>Completa tu perfil y experiencia</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="h-8 w-8 rounded-full p-0 flex items-center justify-center">
                  2
                </Badge>
                <span>Establece tus tarifas y disponibilidad</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="h-8 w-8 rounded-full p-0 flex items-center justify-center">
                  3
                </Badge>
                <span>¡Empieza a recibir solicitudes de jugadores!</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary">¿Tienes Preguntas?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Nuestro equipo está aquí para ayudarte a comenzar tu viaje como entrenador.
              </p>
              <p className="text-sm font-medium">
                📧 Contacto: abengolea1@gmail.com
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

