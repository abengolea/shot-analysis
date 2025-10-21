'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EvidenceModal } from './evidence-modal';
import { Eye, Lock } from 'lucide-react';

interface EvidenceButtonProps {
  analysisId: string;
  paramId: string;
  paramName: string;
  isPro?: boolean;
  disabled?: boolean;
  className?: string;
  keyframes?: Array<{
    index: number;
    timestamp: number;
    description: string;
    imageUrl: string;
  }>;
}

export function EvidenceButton({ 
  analysisId, 
  paramId, 
  paramName, 
  isPro = false,
  disabled = false,
  className = '',
  keyframes = []
}: EvidenceButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (!disabled) {
      setIsModalOpen(true);
    }
  };

  if (disabled || !isPro) {
    return (
      <Button
        onClick={handleClick}
        disabled={true}
        variant="outline"
        size="sm"
        className={`${className} cursor-not-allowed opacity-60`}
        title="Disponible en análisis PRO"
      >
        <Lock className="w-3 h-3 mr-1" />
        Ver fotogramas (PRO)
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={handleClick}
        variant="outline"
        size="sm"
        className={`${className} hover:bg-purple-50 hover:border-purple-200`}
        title="Ver evidencia visual"
      >
        <Eye className="w-3 h-3 mr-1" />
        Ver fotogramas
      </Button>
      
      {isModalOpen && (
        <EvidenceModal
          analysisId={analysisId}
          paramId={paramId}
          paramName={paramName}
          onClose={() => setIsModalOpen(false)}
          isPro={isPro}
          keyframes={keyframes}
        />
      )}
    </>
  );
}
