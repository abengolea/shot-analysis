"use client";

import { useState, useEffect } from 'react';
import Link from "next/link";
import { PlusCircle, User, BarChart, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';


function FormattedDate({ dateString }: { dateString: string }) {
    const [formattedDate, setFormattedDate] = useState('');

    useEffect(() => {
        setFormattedDate(new Date(dateString).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric'}));
    }, [dateString]);

    return <>{formattedDate || '...'}</>;
}


export default function DashboardPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  // Si está cargando, mostrar loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario, redirigir al login
  if (!user || !userProfile) {
    router.push('/login');
    return null;
  }

  // Por ahora, no hay análisis reales, así que mostramos 0
  const userAnalyses: any[] = [];
  const lastAnalysis = null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={userProfile.avatarUrl} alt={userProfile.name} />
              <AvatarFallback>{userProfile.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-headline text-3xl font-bold tracking-tight">
                Bienvenido, {userProfile.name}
              </h1>
              <p className="text-muted-foreground">Aquí está tu resumen de actividad.</p>
            </div>
        </div>

        <div className="flex items-center gap-2">
            <Button asChild>
              <Link href="/upload">
                <PlusCircle className="mr-2 h-4 w-4" />
                Analizar Nuevo Lanzamiento
              </Link>
            </Button>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Análisis</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userAnalyses.length}</div>
            <p className="text-xs text-muted-foreground">
              análisis completados en total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nivel Actual</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userProfile.role === 'player' && userProfile.playerLevel ? userProfile.playerLevel : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {userProfile.role === 'player' ? 'según tu último análisis' : 'no aplica para entrenadores'}
            </p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Último Lanzamiento Analizado</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lastAnalysis ? lastAnalysis.shotType : 'N/A'}</div>
             <p className="text-xs text-muted-foreground">
              {lastAnalysis ? <FormattedDate dateString={lastAnalysis.createdAt} /> : 'Aún no hay análisis'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Análisis Recientes</CardTitle>
          <CardDescription>
            Revisa tus análisis de lanzamiento más recientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <p className="mb-4">Aún no tienes análisis de lanzamiento.</p>
            <Button asChild>
              <Link href="/upload">
                <PlusCircle className="mr-2 h-4 w-4" />
                Analiza tu primer lanzamiento
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
