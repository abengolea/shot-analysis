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
import { mockPlayers, mockAnalyses } from "@/lib/mock-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Assuming a single logged-in user for now.
const currentUser = mockPlayers[0];
const userAnalyses = mockAnalyses.filter(a => a.playerId === currentUser.id);

function FormattedDate({ dateString }: { dateString: string }) {
    const [formattedDate, setFormattedDate] = useState('');

    useEffect(() => {
        setFormattedDate(new Date(dateString).toLocaleDateString());
    }, [dateString]);

    return <>{formattedDate || '...'}</>;
}


export default function DashboardPage() {
  const lastAnalysis = userAnalyses.length > 0 ? userAnalyses[userAnalyses.length - 1] : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
              <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-headline text-3xl font-bold tracking-tight">
                Bienvenido, {currentUser.name}
              </h1>
              <p className="text-muted-foreground">Aquí está tu resumen de actividad.</p>
            </div>
        </div>

        <div className="flex items-center gap-2">
            <Button asChild>
              <Link href="/analysis/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Analizar Nuevo Tiro
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
            <div className="text-2xl font-bold">{currentUser.playerLevel}</div>
            <p className="text-xs text-muted-foreground">
              según tu último análisis
            </p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Último Tiro Analizado</CardTitle>
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
            Revisa tus análisis de tiro más recientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
              {userAnalyses.slice(0, 3).map((analysis) => (
                <Link href={`/analysis/${analysis.id}`} key={analysis.id}>
                  <div className="group flex items-center gap-4 rounded-lg border p-4 transition-all hover:bg-muted/50 hover:shadow-sm">
                    <div className="flex-1">
                      <p className="font-semibold">Análisis de {analysis.shotType}</p>
                      <p className="text-sm text-muted-foreground">
                        <FormattedDate dateString={analysis.createdAt} />
                      </p>
                    </div>
                    <p className="text-sm font-medium text-primary transition-transform group-hover:translate-x-1">
                      Ver Detalles
                    </p>
                  </div>
                </Link>
              ))}
               {userAnalyses.length === 0 && (
                 <p className="py-8 text-center text-muted-foreground">No se encontraron análisis.</p>
              )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
