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
import { PlayerProfileClient } from "@/components/player-profile-client";


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

  return <PlayerProfileClient player={player} analyses={analyses} />;
}
