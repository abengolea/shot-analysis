import { AnalysisForm } from "@/components/analysis-form";
import { mockPlayers } from "@/lib/mock-data";

export default function NewAnalysisPage() {
  // In a real app, you'd fetch players from your database
  const players = mockPlayers;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          Analyze New Shot
        </h1>
        <p className="mt-2 text-muted-foreground">
          Fill in the details below to get an AI-powered analysis of a player's shot.
        </p>
      </div>
      <AnalysisForm players={players} />
    </div>
  );
}
