import { notFound } from "next/navigation";
import { mockPlayers, mockAnalyses, mockPlayerEvaluations, mockPlayerComments } from "@/lib/mock-data";
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

  // Get evaluations and comments for this player
  const evaluations = mockPlayerEvaluations.filter((e) => e.playerId === params.id);
  const comments = mockPlayerComments.filter((c) => c.playerId === params.id);

  if (!player) {
    notFound();
  }

  return (
    <PlayerProfileClient 
      player={player} 
      analyses={analyses} 
      evaluations={evaluations}
      comments={comments}
    />
  );
}
