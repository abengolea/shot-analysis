import { AnalysisPageClient } from '@/components/analysis-page-client'

interface AnalysisPageProps {
  params: {
    id: string
  }
}

export default function AnalysisPage({ params }: AnalysisPageProps) {
  return <AnalysisPageClient id={params.id} />
}