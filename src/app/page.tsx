import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerCard } from "@/components/player-card";
import { mockPlayers } from "@/lib/mock-data";

export default function DashboardPage() {
  const players = mockPlayers;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Players
        </h1>
        <Button asChild>
          <Link href="/analysis/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Analyze New Shot
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </div>
    </div>
  );
}
