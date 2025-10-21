import { AnalysisPageClient } from '@/components/analysis-page-client'

interface AnalysisPageProps {
  params: {
    id: string
  }
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { id } = await params;
  return <AnalysisPageClient id={id} />
}

