import { AnalysisForm } from "@/components/analysis-form";

export default function NewAnalysisPage() {

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tight">
          Analizar Nuevo Tiro
        </h1>
        <p className="mt-2 text-muted-foreground">
          Completa los detalles a continuación para obtener un análisis de tiro de un jugador con IA.
        </p>
      </div>
      <AnalysisForm />
    </div>
  );
}
