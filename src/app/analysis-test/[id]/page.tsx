import { AnalysisTestPageClient } from '@/components/analysis-test-page-client'

interface AnalysisTestPageProps {
  params: {
    id: string
  }
}

export default async function AnalysisTestPage({ params }: AnalysisTestPageProps) {
  const { id } = await params;
  return <AnalysisTestPageClient id={id} />
}
