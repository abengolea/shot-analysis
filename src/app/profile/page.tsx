"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { User, Shield, Calendar, MapPin, Phone, Award, Briefcase, GraduationCap, Clock } from "lucide-react";
import { Player, Coach } from "@/lib/types";
import { storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Switch } from "@/components/ui/switch";

export default function ProfilePage() {
  const { user, userProfile, updateUserProfile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userProfile) {
      setFormData(userProfile);
    }
  }, [userProfile]);

  if (!user || !userProfile) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Cargando perfil...</h1>
        </div>
      </div>
    );
  }

  const isCoach = userProfile?.role === 'coach';
  const playerProfile = userProfile as Player;
  const coachProfile = userProfile as Coach;

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleChangePhotoClick = () => {
    fileInputRef.current?.click();
  };

  // Helpers de fecha seguros (Date | string | Firestore Timestamp)
  const toDateOrNull = (value: any): Date | null => {
    try {
      if (!value) return null;
      if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
      if (typeof value === 'string') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
      }
      if (value && typeof value.toDate === 'function') {
        const d = value.toDate();
        return d instanceof Date && !isNaN(d.getTime()) ? d : null;
      }
      return null;
    } catch {
      return null;
    }
  };

  const formatDateForInput = (value: any): string => {
    const d = toDateOrNull(value);
    if (!d) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDateForDisplay = (value: any): string => {
    const d = toDateOrNull(value);
    return d ? d.toLocaleDateString() : 'N/A';
  };

  const cropImageToSquare = async (file: File, outputSize = 512): Promise<Blob> => {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    const sourceSize = Math.min(img.width, img.height);
    const sx = (img.width - sourceSize) / 2;
    const sy = (img.height - sourceSize) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear el contexto de canvas');

    ctx.drawImage(
      img,
      sx, sy, sourceSize, sourceSize,
      0, 0, outputSize, outputSize
    );

    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('No se pudo crear la imagen recortada');
    return blob;
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      // Resetear el input para permitir re-seleccionar el mismo archivo después
      e.currentTarget.value = '';

      // Validaciones
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Archivo inválido', description: 'Selecciona una imagen JPG/PNG/WebP', variant: 'destructive' });
        return;
      }
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast({ title: 'Imagen muy grande', description: 'El tamaño máximo es 5 MB', variant: 'destructive' });
        return;
      }

      setIsUploading(true);
      setUploadProgress(null);

      // Recorte cuadrado y redimensionado
      const croppedBlob = await cropImageToSquare(file, 512);
      const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });

      // Subir a Firebase Storage
      const path = `avatars/${user!.uid}/${Date.now()}.jpg`;
      const sref = storageRef(storage, path);
      await uploadBytes(sref, croppedFile, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(sref);

      // Guardar en Firestore
      const result = await updateUserProfile({ avatarUrl: url });
      if (result.success) {
        toast({ title: 'Foto actualizada', description: 'Tu foto de perfil fue cambiada.' });
      } else {
        toast({ title: 'Error al guardar', description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'No se pudo cargar la imagen', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setIsUploading(true);
      const result = await updateUserProfile({ avatarUrl: '' });
      if (result.success) {
        toast({ title: 'Foto eliminada', description: 'Se restauró el avatar por defecto.' });
      } else {
        toast({ title: 'Error al guardar', description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo quitar la foto', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const payload: any = {};

      // Nombre siempre editable
      if (typeof formData.name === 'string') {
        payload.name = formData.name;
      }

      if (isCoach) {
        if (formData.experience !== undefined) payload.experience = formData.experience;
        if (formData.bio !== undefined) payload.bio = formData.bio;

        const rateNum = formData.ratePerAnalysis === '' || formData.ratePerAnalysis === undefined
          ? undefined
          : Number(formData.ratePerAnalysis);
        if (typeof rateNum === 'number' && !Number.isNaN(rateNum)) payload.ratePerAnalysis = rateNum;

        const yearsNum = formData.yearsOfExperience === '' || formData.yearsOfExperience === undefined
          ? undefined
          : Number(formData.yearsOfExperience);
        if (typeof yearsNum === 'number' && !Number.isNaN(yearsNum)) payload.yearsOfExperience = yearsNum;
      } else {
        // Normalización específica de jugador
        if (formData.dob) {
          const dobVal = formData.dob;
          if (typeof dobVal === 'string') {
            payload.dob = new Date(dobVal);
          } else if (dobVal && typeof dobVal.toDate === 'function') {
            payload.dob = dobVal.toDate();
          } else if (dobVal instanceof Date) {
            payload.dob = dobVal;
          }
        }
        if (formData.country !== undefined) payload.country = formData.country;
        if (formData.ageGroup !== undefined) payload.ageGroup = formData.ageGroup;
        if (formData.playerLevel !== undefined) payload.playerLevel = formData.playerLevel;
        if (formData.position !== undefined) payload.position = formData.position;

        // Altura y Envergadura en cm
        const heightNum = formData.height === '' || formData.height === undefined ? undefined : Number(formData.height);
        if (typeof heightNum === 'number' && !Number.isNaN(heightNum)) payload.height = heightNum;
        const wingspanNum = formData.wingspan === '' || formData.wingspan === undefined ? undefined : Number(formData.wingspan);
        if (typeof wingspanNum === 'number' && !Number.isNaN(wingspanNum)) payload.wingspan = wingspanNum;
      }

      payload.updatedAt = new Date();

      const result = await updateUserProfile(payload);
      if (result.success) {
        toast({
          title: "Perfil actualizado",
          description: "Tu información ha sido guardada exitosamente.",
        });
        setIsEditing(false);
      } else {
        toast({ title: 'Error al guardar', description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el perfil. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Mi Perfil</h1>
        <p className="text-muted-foreground">
          Gestiona tu información personal y configuración de cuenta
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Información Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Información Básica */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Información Básica</CardTitle>
                  <CardDescription>
                    Tu información personal y de contacto
                  </CardDescription>
                </div>
                <Button
                  variant={isEditing ? "outline" : "default"}
                  onClick={() => setIsEditing(!isEditing)}
                  disabled={isLoading}
                >
                  {isEditing ? "Cancelar" : "Editar"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user.email || ''}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              {isCoach ? (
                // Campos específicos del entrenador
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="experience">Experiencia</Label>
                    <Textarea
                      id="experience"
                      value={formData.experience || ''}
                      onChange={(e) => handleInputChange('experience', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Describe tu experiencia como entrenador..."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ratePerAnalysis">Tarifa por Análisis ($)</Label>
                      <Input
                        id="ratePerAnalysis"
                        type="number"
                        value={formData.ratePerAnalysis ?? ''}
                        onChange={(e) => handleInputChange('ratePerAnalysis', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="yearsOfExperience">Años de Experiencia</Label>
                      <Input
                        id="yearsOfExperience"
                        type="number"
                        value={formData.yearsOfExperience ?? ''}
                        onChange={(e) => handleInputChange('yearsOfExperience', e.target.value === '' ? '' : parseInt(e.target.value))}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Biografía</Label>
                    <Textarea
                      id="bio"
                      value={formData.bio || ''}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Cuéntanos sobre ti..."
                    />
                  </div>
                </div>
              ) : (
                // Campos específicos del jugador
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dob">Fecha de Nacimiento</Label>
                      <Input
                        id="dob"
                        type="date"
                        value={formatDateForInput(formData.dob)}
                        onChange={(e) => handleInputChange('dob', e.target.value)}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">País</Label>
                      <Input
                        id="country"
                        value={formData.country || ''}
                        onChange={(e) => handleInputChange('country', e.target.value)}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ageGroup">Grupo de Edad</Label>
                      <Select
                        value={formData.ageGroup || ''}
                        onValueChange={(value) => handleInputChange('ageGroup', value)}
                        disabled={!isEditing}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="U10">U10</SelectItem>
                          <SelectItem value="U13">U13</SelectItem>
                          <SelectItem value="U15">U15</SelectItem>
                          <SelectItem value="U18">U18</SelectItem>
                          <SelectItem value="Amateur">Amateur</SelectItem>
                          <SelectItem value="SemiPro">Semi-Profesional</SelectItem>
                          <SelectItem value="Pro">Profesional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="playerLevel">Nivel</Label>
                      <Select
                        value={formData.playerLevel || ''}
                        onValueChange={(value) => handleInputChange('playerLevel', value)}
                        disabled={!isEditing}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Principiante">Principiante</SelectItem>
                          <SelectItem value="Intermedio">Intermedio</SelectItem>
                          <SelectItem value="Avanzado">Avanzado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="position">Posición</Label>
                      <Select
                        value={formData.position || ''}
                        onValueChange={(value) => handleInputChange('position', value)}
                        disabled={!isEditing}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Base">Base</SelectItem>
                          <SelectItem value="Escolta">Escolta</SelectItem>
                          <SelectItem value="Alero">Alero</SelectItem>
                          <SelectItem value="Ala-Pívot">Ala-Pívot</SelectItem>
                          <SelectItem value="Pívot">Pívot</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="height">Altura (cm)</Label>
                      <Input
                        id="height"
                        type="number"
                        value={formData.height ?? ''}
                        onChange={(e) => handleInputChange('height', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wingspan">Envergadura (cm)</Label>
                      <Input
                        id="wingspan"
                        type="number"
                        value={formData.wingspan ?? ''}
                        onChange={(e) => handleInputChange('wingspan', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                </div>
              )}

              {isEditing && (
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar con información del perfil */}
        <div className="space-y-6">
          {/* Avatar y Estado */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Avatar className="h-24 w-24 mx-auto">
                  <AvatarImage src={userProfile.avatarUrl} alt={userProfile.name} />
                  <AvatarFallback className="text-2xl">
                    {getInitials(userProfile.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center justify-center gap-2">
                  <Button size="sm" onClick={handleChangePhotoClick} disabled={isUploading}>
                    Cambiar foto
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleRemovePhoto} disabled={isUploading}>
                    Quitar foto
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelected}
                />
                <p className="text-xs text-muted-foreground">JPG/PNG/WebP, máximo 5 MB</p>
                {isUploading && (
                  <p className="text-xs text-muted-foreground">Subiendo imagen...</p>
                )}
                <div>
                  <h3 className="font-semibold text-lg">{userProfile.name}</h3>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    {isCoach ? (
                      <>
                        <Shield className="h-4 w-4 text-blue-500" />
                        <Badge variant="secondary">Entrenador</Badge>
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4 text-green-500" />
                        <Badge variant="secondary">Jugador</Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estadísticas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estadísticas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Miembro desde</span>
                <span className="text-sm font-medium">
                  {formatDateForDisplay(userProfile.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estado</span>
                <Badge variant={userProfile.status === 'active' ? 'default' : 'secondary'}>
                  {userProfile.status === 'active' ? 'Activo' : 'Pendiente'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Acciones Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full" asChild>
                <a href={isCoach ? '/coach/dashboard' : '/dashboard'}>
                  Ir al Dashboard
                </a>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <a href="/upload" onClick={(e) => {
                  const p: any = userProfile as any;
                  const isNonEmptyString = (v: any) => typeof v === 'string' && v.trim().length > 0;
                  const isComplete = !!p && isNonEmptyString(p.name) && !!p.dob && isNonEmptyString(p.country) && isNonEmptyString(p.ageGroup) && isNonEmptyString(p.playerLevel) && isNonEmptyString(p.position) && p.height && p.wingspan;
                  if (!isComplete) {
                    e.preventDefault();
                    // Mostrar un toast suave aquí, y que el usuario ya está en perfil
                    // No se agregó AlertDialog para no duplicar; el usuario está en esta página
                  }
                }}>
                  Subir Video
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

