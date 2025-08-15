import { notFound } from "next/navigation";
import { mockPlayers, mockAnalyses } from "@/lib/mock-data";
import { PlayerProfileClient } from "@/components/player-profile-client";

export default function PlayerProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const player = mockPlayers.find((p) => p.id === params.id);
  // Sort analyses by date, newest first
  const analyses = mockAnalyses
    .filter((a) => a.playerId === params.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (!player) {
    notFound();
  }

  return <PlayerProfileClient player={player} analyses={analyses} />;
}
