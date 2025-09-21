'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { adminUpdateWallet } from '@/app/actions';
import { useRouter } from 'next/navigation';

interface AdminWalletFormProps {
  userId: string;
  initialCredits: number;
  initialFreeAnalysesUsed: number;
  redirectTo?: string;
}

export function AdminWalletForm({ 
  userId, 
  initialCredits, 
  initialFreeAnalysesUsed, 
  redirectTo 
}: AdminWalletFormProps) {
  const [credits, setCredits] = useState(initialCredits);
  const [freeAnalysesUsed, setFreeAnalysesUsed] = useState(initialFreeAnalysesUsed);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const router = useRouter();

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = await adminUpdateWallet(null, formData);
        
        if (result.success) {
          setFeedback({ type: 'success', message: 'Wallet actualizada correctamente' });
          
          // Refrescar los datos de la página
          router.refresh();
          
          // Limpiar el feedback después de 3 segundos
          setTimeout(() => setFeedback(null), 3000);
        } else {
          console.error('Error en adminUpdateWallet:', result);
          setFeedback({ 
            type: 'error', 
            message: result.message || 'Error al actualizar wallet' 
          });
          
          // Limpiar el error después de 5 segundos
          setTimeout(() => setFeedback(null), 5000);
        }
      } catch (error) {
        setFeedback({ 
          type: 'error', 
          message: 'Error inesperado al actualizar wallet' 
        });
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Wallet</div>
      
      {feedback && (
        <div className={`text-sm p-2 rounded ${
          feedback.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {feedback.message}
        </div>
      )}
      
      <form action={handleSubmit} className="grid grid-cols-2 gap-2">
        <input type="hidden" name="userId" value={userId} />
        {/* No enviamos redirectTo porque manejamos la actualización manualmente con router.refresh() */}
        
        <label className="text-sm text-muted-foreground">Créditos</label>
        <input 
          name="credits" 
          type="number" 
          value={credits}
          onChange={(e) => setCredits(Number(e.target.value))}
          disabled={isPending}
          className="border rounded px-2 py-1 disabled:opacity-50" 
        />
        
        <label className="text-sm text-muted-foreground">Gratis usados</label>
        <input 
          name="freeAnalysesUsed" 
          type="number" 
          value={freeAnalysesUsed}
          onChange={(e) => setFreeAnalysesUsed(Number(e.target.value))}
          disabled={isPending}
          className="border rounded px-2 py-1 disabled:opacity-50" 
        />
        
        <div className="col-span-2 flex justify-end">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
