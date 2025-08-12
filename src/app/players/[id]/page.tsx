import Link from "next/link";
import Image from "next/image";
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


const chartData = [
  { month: "January", score: 75 },
  { month: "February", score: 78 },
  { month: "March", score: 82 },
  { month: "April", score: 80 },
  { month: "May", score: 85 },
  { month: "June", score: 88 },
];


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
                <FileText className="h-6 w-6" /> Analysis History
              </CardTitle>
              <CardDescription>
                Review past shot analyses and track improvements.
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
                          <p className="font-semibold">{analysis.shotType} Analysis</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {new Date(analysis.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                         <p className="text-sm font-medium text-primary transition-transform group-hover:translate-x-1">
                          View Details
                        </p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="py-8 text-center text-muted-foreground">
                    No analyses found for this player yet.
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
                <BarChart className="h-6 w-6" /> Progress
              </CardTitle>
              <CardDescription>
                Overall shot score over the last 6 months.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PlayerProgressChart data={chartData} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
