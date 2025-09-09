"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

type PromptConfig = {
  intro?: string;
  fluidezHelp?: string;
  setPointHelp?: string;
  resources?: string[]; // URLs de imágenes o docs
  // Guías por categoría del checklist
  categoryGuides?: Record<string, { guide?: string; resources?: string[] }>;
};

export default function AdminPromptsPage() {
  const { user } = useAuth();
  const [shotType, setShotType] = useState<'tres' | 'media' | 'libre'>('tres');
  const [data, setData] = useState<PromptConfig>({});
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      const res = await fetch(`/api/admin/prompts?shotType=${shotType}`);
      const json = await res.json();
      setData(json?.config || {});
    };
    void run();
  }, [shotType]);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/admin/list-categories');
        const json = await res.json();
        if (Array.isArray(json?.categories)) {
          setCategories(json.categories);
        }
      } catch {
        // ignore
      }
    };
    void run();
  }, [shotType]);

  const save = async () => {
    setSaving(true);
    try {
      const token = user ? await (await import('firebase/auth')).getIdToken(user, true) : '';
      await fetch(`/api/admin/prompts?shotType=${shotType}`, {
        method: 'POST',
        headers: token ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: data }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Ajustes de Prompts (IA)</h1>
      <div className="flex gap-2">
        <Button variant={shotType==='tres'?'default':'outline'} onClick={() => setShotType('tres')}>Tres</Button>
        <Button variant={shotType==='media'?'default':'outline'} onClick={() => setShotType('media')}>Media</Button>
        <Button variant={shotType==='libre'?'default':'outline'} onClick={() => setShotType('libre')}>Tiro Libre</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Textos y recursos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Intro adicional para el prompt</label>
            <Textarea value={data.intro || ''} onChange={e=>setData(prev=>({...prev, intro: e.target.value}))} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Guía sobre Fluidez / Armonía</label>
            <Textarea value={data.fluidezHelp || ''} onChange={e=>setData(prev=>({...prev, fluidezHelp: e.target.value}))} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Guía sobre Set Point</label>
            <Textarea value={data.setPointHelp || ''} onChange={e=>setData(prev=>({...prev, setPointHelp: e.target.value}))} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">URLs de recursos (1 por línea)</label>
            <Textarea value={(data.resources||[]).join('\n')} onChange={e=>setData(prev=>({...prev, resources: e.target.value.split('\n').map(s=>s.trim()).filter(Boolean)}))} />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Guías por Categoría (aplican a todas las categorías del checklist)</div>
            <div className="space-y-3">
              {categories.map((cat) => {
                const cg = data.categoryGuides?.[cat] || {};
                return (
                  <div key={cat} className="border rounded p-3 space-y-2">
                    <div className="text-sm font-semibold" title={cat}>{cat}</div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Guía</label>
                      <Textarea
                        value={cg.guide || ''}
                        onChange={(e)=>setData(prev=>({
                          ...prev,
                          categoryGuides: { 
                            ...(prev.categoryGuides||{}),
                            [cat]: { ...(prev.categoryGuides?.[cat]||{}), guide: e.target.value }
                          }
                        }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Recursos (1 por línea)</label>
                      <Textarea
                        value={(cg.resources||[]).join('\n')}
                        onChange={(e)=>setData(prev=>({
                          ...prev,
                          categoryGuides: {
                            ...(prev.categoryGuides||{}),
                            [cat]: { ...(prev.categoryGuides?.[cat]||{}), resources: e.target.value.split('\n').map(s=>s.trim()).filter(Boolean) }
                          }
                        }))}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Input placeholder="Agregar categoría" value={newCategory} onChange={(e)=>setNewCategory(e.target.value)} className="w-80 h-8" />
              <Button size="sm" onClick={()=>{
                const cat = newCategory.trim();
                if (!cat) return;
                if (!categories.includes(cat)) setCategories(prev=>[...prev, cat]);
                setData(prev=>({ ...prev, categoryGuides: { ...(prev.categoryGuides||{}), [cat]: (prev.categoryGuides?.[cat]||{ guide: '', resources: [] }) }}));
                setNewCategory("");
              }}>Agregar</Button>
            </div>
          </div>
          <div>
            <Button onClick={save} disabled={saving}>{saving?'Guardando...':'Guardar'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


