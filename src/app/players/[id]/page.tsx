import { notFound } from "next/navigation";
import { mockPlayers, mockAnalyses } from "@/lib/mock-data";
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
