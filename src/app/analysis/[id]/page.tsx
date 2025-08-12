import { AnalysisPageClient } from "@/components/analysis-page-client";

export default function AnalysisPage({ params }: { params: { id: string } }) {
  return <AnalysisPageClient id={params.id} />;
}
