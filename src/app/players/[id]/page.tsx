"use client";

import { useState, useEffect } from 'react';
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileText,
  Calendar,
  BarChart,
  Target,
} from "lucide-react";
import { mockPlayers, mockAnalyses } from "@/lib/mock-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { PlayerProgressChart } from "@/components/player-progress-chart";


// Helper to format chart data from analyses
const getChartData = (playerId: string) => {
    const playerAnalyses = mockAnalyses
        .filter(a => a.playerId === playerId && a.score !== undefined)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (playerAnalyses.length === 0) return [];
    
    const monthlyScores: { [key: string]: number[] } = {};

    playerAnalyses.forEach(analysis => {
        const month = new Date(analysis.createdAt).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        if (!monthlyScores[month]) {
            monthlyScores[month] = [];
        }
        monthlyScores[month].push(analysis.score!);
    });

    return Object.entries(monthlyScores).map(([month, scores]) => ({
        month: month.split(' ')[0].charAt(0).toUpperCase() + month.split(' ')[0].slice(1), // just month name, capitalized
        score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }));
};

function FormattedDate({ dateString }: { dateString: string }) {
    const [formattedDate, setFormattedDate] = useState('');

    useEffect(() => {
        setFormattedDate(new Date(dateString).toLocaleDateString('es-ES'));
    }, [dateString]);

    return <>{formattedDate || '...'}</>;
}


export default function PlayerProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const player = mockPlayers.find((p) => p.id === params.id);
  const analyses = mockAnalyses.filter((a) => a.playerId === params.id);

  if (!player) {
    notFound();
  }

  const chartData = getChartData(player.id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Avatar className="h-24 w-24 border-4 border-primary/20">
          <AvatarImage src={player.avatarUrl} alt={player.name} />
          <AvatarFallback className="text-3xl">
            {player.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="font-headline text-4xl font-bold tracking-tight">
            {player.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">{player.ageGroup}</Badge>
            <Badge variant="secondary">{player.playerLevel}</Badge>
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-headline">
                <FileText className="h-6 w-6" /> Historial de Análisis
              </CardTitle>
              <CardDescription>
                Revisa análisis de tiros anteriores y sigue el progreso.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {analyses.length > 0 ? (
                  analyses.map((analysis) => (
                    <Link href={`/analysis/${analysis.id}`} key={analysis.id}>
                      <div className="group flex items-center gap-4 rounded-lg border p-4 transition-all hover:bg-muted/50 hover:shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Target className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">Análisis de {analysis.shotType}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <FormattedDate dateString={analysis.createdAt} />
                          </p>
                        </div>
                         {analysis.score !== undefined && (
                            <div className="text-right">
                                <p className="text-sm font-semibold text-muted-foreground">Puntuación</p>
                                <p className="font-headline text-2xl font-bold text-primary">{analysis.score}</p>
                            </div>
                        )}
                         <p className="text-sm font-medium text-primary transition-transform group-hover:translate-x-1">
                          Ver Detalles
                        </p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="py-8 text-center text-muted-foreground">
                    Aún no se han encontrado análisis para este jugador.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-headline">
                <BarChart className="h-6 w-6" /> Progreso
              </CardTitle>
              <CardDescription>
                Puntuación general de tiro en los últimos meses.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                 <PlayerProgressChart data={chartData} />
              ) : (
                <div className="flex h-[250px] items-center justify-center">
                    <p className="text-center text-muted-foreground">No hay suficientes datos de puntuación para mostrar el progreso.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
