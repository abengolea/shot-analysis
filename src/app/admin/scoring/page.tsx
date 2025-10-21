"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";

type Weights = Record<string, number>;

export default function ScoringWeightsPage() {
  const { user } = useAuth();
  const [shotType, setShotType] = useState<'tres' | 'media' | 'libre'>('tres');
  const [weights, setWeights] = useState<Weights>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newWeight, setNewWeight] = useState<number>(1);
  const [autoInit, setAutoInit] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);

  const totalWeight = useMemo(() => Object.values(weights).reduce((s, v) => s + (Number(v) || 0), 0), [weights]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/scoring-weights?shotType=${shotType}`);
        const data = await res.json();
        if (data?.weights) setWeights(data.weights);
        // Intentar autocompletar categorías existentes si weights está vacío
        if (!data?.weights || Object.keys(data.weights).length === 0) {
          const token = user ? await (await import('firebase/auth')).getIdToken(user, true) : '';
          const catsRes = await fetch('/api/admin/list-categories', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
          if (catsRes.ok) {
            const catsData = await catsRes.json();
            if (Array.isArray(catsData?.categories) && catsData.categories.length) {
              // Si estamos en Tres y no hay pesos, usar preset exacto solicitado
              if (shotType === 'tres') {
                setWeights({
                  'Fluidez / Armonía (transferencia energética)': 60,
                  'Preparación': 8,
                  'Ascenso': 19, // incluye Set Point 8% + Alineación del codo 7% + 4% resto ascenso
                  'Liberación': 10,
                  'Finalización y Seguimiento': 3,
                });
                setAutoInit(true);
              } else {
                const initial: Record<string, number> = {};
                for (const c of catsData.categories) initial[c] = 1;
                setWeights(initial);
                setAutoInit(true);
              }
            } else {
              if (shotType === 'tres') {
                // Preset solicitado para Tres (65% Fluidez + 35% distribuido)
                setWeights({
                  'Fluidez / Armonía (transferencia energética)': 60,
                  'Preparación': 8,
                  'Ascenso': 19,
                  'Liberación': 10,
                  'Finalización y Seguimiento': 3,
                });
                setAutoInit(true);
              } else {
                setWeights({});
              }
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [shotType]);

  // Auto-guardar si acabamos de inicializar desde cero (para que quede persistido y se recalcule)
  useEffect(() => {
    const run = async () => {
      if (!autoInit || autoSaved) return;
      if (Object.keys(weights).length === 0) return;
      try {
        setSaving(true);
        const token = user ? await (await import('firebase/auth')).getIdToken(user, true) : '';
        const res = await fetch(`/api/admin/scoring-weights?shotType=${shotType}` , {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ weights })
        });
        if (!res.ok) throw new Error('Error guardando');
        await fetch(`/api/admin/recalculate-scores?shotType=${shotType}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setAutoSaved(true);
      } catch (e) {
        console.warn('Auto-guardado de pesos falló', e);
      } finally {
        setSaving(false);
      }
    };
    run();
  }, [autoInit, autoSaved, weights, user, shotType]);

  const save = async () => {
    setSaving(true);
    try {
      const token = user ? await (await import('firebase/auth')).getIdToken(user, true) : '';
      const res = await fetch(`/api/admin/scoring-weights?shotType=${shotType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ weights })
      });
      if (!res.ok) throw new Error('Error guardando');
      // Recalcular promedios
      const recalc = await fetch(`/api/admin/recalculate-scores?shotType=${shotType}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!recalc.ok) throw new Error('Error recalculando');
    } catch (e) {
      console.error(e);
      alert('No se pudieron guardar los pesos');
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    const key = newCategory.trim();
    const val = Number(newWeight);
    if (!key) return;
    setWeights(prev => ({ ...prev, [key]: isNaN(val) ? 1 : val }));
    setNewCategory("");
    setNewWeight(1);
  };

  const removeCategory = (cat: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [cat]: _, ...rest } = weights;
    setWeights(rest);
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Ponderaciones de Puntuación</CardTitle>
          <CardDescription>Define el peso relativo de cada categoría del checklist. Por ejemplo, Biomécanica o Empuje de piernas puede pesar más.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Cargando...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="text-sm">Tipo de tiro</div>
                <select
                  className="h-8 rounded border px-2"
                  value={shotType}
                  onChange={(e) => { setShotType(e.target.value as any); setAutoInit(false); setAutoSaved(false); }}
                >
                  <option value="tres">Lanzamiento de Tres</option>
                  <option value="media">Lanzamiento de Media Distancia (Jump Shot)</option>
                  <option value="libre">Tiro Libre</option>
                </select>
              </div>
              <div className="text-sm text-muted-foreground">Peso total actual: {totalWeight}</div>
              <div className="space-y-2">
                {Object.entries(weights).map(([cat, w]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <div className="w-64 truncate" title={cat}>{cat}</div>
                    <Input type="number" step="0.1" value={w} onChange={(e) => setWeights(prev => ({ ...prev, [cat]: Number(e.target.value) }))} className="w-28 h-8" />
                    <Button variant="outline" size="sm" onClick={() => removeCategory(cat)}>Quitar</Button>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <Input placeholder="Nueva categoría (exacto al nombre en checklist)" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-80 h-8" />
                <Input type="number" step="0.1" value={newWeight} onChange={(e) => setNewWeight(Number(e.target.value))} className="w-28 h-8" />
                <Button size="sm" onClick={addCategory}>Agregar</Button>
              </div>
              <div className="flex justify-end">
                <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

