"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { 
  FileText, 
  Zap, 
  Target, 
  BookOpen, 
  Save, 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Link as LinkIcon,
  Plus,
  Trash2,
  Copy,
  Download
} from "lucide-react";

type PromptConfig = {
  intro?: string;
  fluidezHelp?: string;
  setPointHelp?: string;
  resources?: string[]; // URLs de imágenes o docs
  // Guías por categoría del checklist
  categoryGuides?: Record<string, { guide?: string; resources?: string[] }>;
  // Prompts completos por sección (sobrescribe el hardcoded)
  sectionPrompts?: {
    verificacion?: string;
    preparacion?: string;
    ascenso?: string;
    fluidez?: string;
    liberacion?: string;
    seguimiento?: string;
    formatoRespuesta?: string;
  };
};

export default function AdminPromptsPage() {
  const { user } = useAuth();
  const [shotType, setShotType] = useState<'tres' | 'media' | 'libre'>('tres');
  const [data, setData] = useState<PromptConfig>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    intro: true,
    fluidez: true,
    setPoint: true,
    resources: false,
    categories: false,
    basePrompt: false,
    editPrompts: false,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [viewMode, setViewMode] = useState<'customize' | 'view-full' | 'edit-prompts'>('customize');

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
    setSaved(false);
    try {
      const token = user ? await (await import('firebase/auth')).getIdToken(user, true) : '';
      await fetch(`/api/admin/prompts?shotType=${shotType}`, {
        method: 'POST',
        headers: token ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: data }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatePreview());
      alert('✅ Prompt copiado al portapapeles');
    } catch (err) {
      alert('❌ Error al copiar al portapapeles');
    }
  };

  const downloadPrompt = () => {
    const content = generatePreview();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-${shotType}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getShotTypeLabel = (type: 'tres' | 'media' | 'libre') => {
    switch(type) {
      case 'tres': return { label: 'Tiro de Tres', icon: '🎯', color: 'bg-blue-500' };
      case 'media': return { label: 'Media Distancia', icon: '🏀', color: 'bg-orange-500' };
      case 'libre': return { label: 'Tiro Libre', icon: '🎖️', color: 'bg-green-500' };
    }
  };

  const getDefaultSectionPrompts = () => ({
    verificacion: `VERIFICACIÓN INICIAL OBLIGATORIA:
Antes de analizar, DEMUESTRA que ves el video respondiendo:
1. Duración exacta del video en segundos
2. ¿El jugador tira con mano derecha o izquierda?
3. ¿Salta durante el tiro? (sí/no)
4. ¿Se ve la canasta en el video? (sí/no)
5. ¿Desde qué ángulo está grabado? (frontal/lateral/diagonal)
6. ¿Qué elementos del entorno son visibles?

🎯 SISTEMA DE PESOS:
- FLUIDEZ: 47.5% peso (CRÍTICO)
- RESTO DE CATEGORÍAS: 25.06% peso (ALTO)
- SET POINT: 7.86% peso (MEDIO)
- CODO: 6.88% peso (MEDIO)
- ÁNGULO CODO ESTABLE: 5% peso (MEDIO)
- MANO LIBERACIÓN: 3.10% peso (BAJO)
- MANO ASCENSO: 2.07% peso (BAJO)`,

    preparacion: `1) PREPARACIÓN:
   - id: "alineacion_pies", name: "Alineación de los pies"
     Si NO ves ambos pies → na: true, razon: "pies fuera de encuadre"
     Si ves ambos pies → score + timestamp + observación específica
   
   - id: "alineacion_cuerpo", name: "Alineación del cuerpo"
   - id: "muneca_cargada", name: "Muñeca cargada"
   - id: "flexion_rodillas", name: "Flexión de rodillas"
     Si ángulo no permite ver flexión → na: true, razon: "ángulo frontal no muestra flexión"
   
   - id: "hombros_relajados", name: "Hombros relajados"
   - id: "enfoque_visual", name: "Enfoque visual"
     Si no ves ojos/cara → na: true, razon: "rostro no visible/muy lejos"`,

    ascenso: `2) ASCENSO:
   - id: "mano_no_dominante_ascenso", name: "Posición de la mano no dominante (ascenso)" - PESO: 2.07%
   - id: "codos_cerca_cuerpo", name: "Codos cerca del cuerpo" - PESO: 6.88%
   - id: "angulo_codo_fijo_ascenso", name: "Ángulo de codo estable en ascenso" - PESO: 5%
     EVALÚA: Mantener el ángulo del codo fijo desde la toma del balón hasta el set point.
   - id: "subida_recta_balon", name: "Subida recta del balón"
   - id: "trayectoria_hasta_set_point", name: "Trayectoria del balón hasta el set point"
   - id: "set_point", name: "Set point" - PESO: 7.86%
   - id: "tiempo_lanzamiento", name: "Tiempo de lanzamiento (captura → liberación)"`,

    fluidez: `3) FLUIDEZ (PESO: 47.5% - CRÍTICO):
   - id: "tiro_un_solo_tiempo", name: "Tiro en un solo tiempo"
     CUENTA pausas > 0.2s, marca timestamps de inicio/fin
   - id: "sincronia_piernas", name: "Transferencia energética – sincronía con piernas"
     COMPARA timestamps de extensión de piernas vs brazos`,

    liberacion: `4) LIBERACIÓN:
   - id: "mano_no_dominante_liberacion", name: "Mano no dominante en la liberación" - PESO: 3.10%
   - id: "extension_completa_brazo", name: "Extensión completa del brazo (follow-through)"
   - id: "giro_pelota", name: "Giro de la pelota (backspin)"
   - id: "angulo_salida", name: "Ángulo de salida"`,

    seguimiento: `5) SEGUIMIENTO / POST-LIBERACIÓN:
   - id: "mantenimiento_equilibrio", name: "Mantenimiento del equilibrio"
   - id: "equilibrio_aterrizaje", name: "Equilibrio en el aterrizaje"
   - id: "duracion_follow_through", name: "Duración del follow-through"
   - id: "consistencia_repetitiva", name: "Consistencia repetitiva"`,

    formatoRespuesta: `FORMATO DE RESPUESTA OBLIGATORIO:
🔍 REGLAS:
- Si NO ves algo claramente → "no_evaluable"
- Proporciona TIMESTAMPS exactos
- DESCRIBE literalmente lo que ves
- Usa evidenceFrames para parámetros evaluables

⛔ PALABRAS PROHIBIDAS:
- "bien alineado", "buena postura", "adecuado", "correcto"
- "mejora la técnica", "trabaja en", "mantén"

✅ PALABRAS REQUERIDAS:
- "En el segundo X.X", "Entre X.Xs y X.Xs"
- "Visible/No visible", "Parcialmente oculto"`
  });

  const getBasePromptText = () => {
    const sections = getDefaultSectionPrompts();
    return `Analiza este video de tiro de baloncesto y describe qué ves.

${sections.verificacion}

${sections.preparacion}

${sections.ascenso}

${sections.fluidez}

${sections.liberacion}

${sections.seguimiento}

${sections.formatoRespuesta}`;
  };

  const generatePreview = () => {
    let preview = "=== PROMPT COMPLETO GENERADO ===\n\n";
    
    preview += "📄 PROMPT BASE:\n";
    preview += getBasePromptText();
    preview += "\n\n";
    
    let hasCustomizations = false;
    
    if (data.intro) {
      hasCustomizations = true;
      preview += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
      preview += "📝 INSTRUCCIONES ADICIONALES:\n" + data.intro + "\n\n";
    }
    
    if (data.fluidezHelp) {
      hasCustomizations = true;
      preview += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
      preview += "⚡ GUÍA FLUIDEZ PERSONALIZADA:\n" + data.fluidezHelp + "\n\n";
    }
    
    if (data.setPointHelp) {
      hasCustomizations = true;
      preview += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
      preview += "🎯 GUÍA SET POINT PERSONALIZADA:\n" + data.setPointHelp + "\n\n";
    }
    
    if (data.categoryGuides && Object.keys(data.categoryGuides).length > 0) {
      hasCustomizations = true;
      preview += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
      preview += "📚 GUÍAS POR CATEGORÍA:\n";
      Object.entries(data.categoryGuides).forEach(([cat, guide]) => {
        if (guide?.guide) {
          preview += `\n🔸 ${cat}: ${guide.guide}\n`;
          if (guide?.resources && guide.resources.length > 0) {
            preview += `   Recursos: ${guide.resources.join(', ')}\n`;
          }
        }
      });
      preview += "\n";
    }
    
    if (data.resources && data.resources.length > 0) {
      hasCustomizations = true;
      preview += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
      preview += "📎 RECURSOS GENERALES:\n" + data.resources.map(r => `- ${r}`).join('\n') + "\n";
    }
    
    if (!hasCustomizations) {
      preview += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
      preview += "ℹ️ Sin personalizaciones adicionales\n";
      preview += "El análisis usará solo el prompt base.";
    }
    
    return preview;
  };

  const countConfiguredItems = () => {
    let count = 0;
    if (data.intro?.trim()) count++;
    if (data.fluidezHelp?.trim()) count++;
    if (data.setPointHelp?.trim()) count++;
    if (data.resources && data.resources.length > 0) count++;
    if (data.categoryGuides) {
      count += Object.values(data.categoryGuides).filter(g => g?.guide?.trim()).length;
    }
    return count;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-blue-600" />
              Configuración de Prompts IA
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Personaliza cómo la IA analiza los lanzamientos según el tipo de tiro
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            {countConfiguredItems()} configuraciones activas
          </Badge>
      </div>

        {/* Shot Type Selection */}
        <Card className="border-2 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              {(['tres', 'media', 'libre'] as const).map((type) => {
                const { label, icon, color } = getShotTypeLabel(type);
                return (
                  <Button
                    key={type}
                    variant={shotType === type ? 'default' : 'outline'}
                    onClick={() => setShotType(type)}
                    className={`flex-1 h-20 text-lg font-semibold transition-all ${
                      shotType === type 
                        ? `${color} hover:opacity-90 shadow-lg scale-105` 
                        : 'hover:scale-105'
                    }`}
                  >
                    <span className="text-3xl mr-3">{icon}</span>
                    {label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* View Mode Selector */}
        <Card className="border-2 shadow-lg">
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant={viewMode === 'customize' ? 'default' : 'outline'}
                onClick={() => setViewMode('customize')}
                className="h-16 text-sm font-semibold"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Personalizar
              </Button>
              <Button
                variant={viewMode === 'edit-prompts' ? 'default' : 'outline'}
                onClick={() => setViewMode('edit-prompts')}
                className="h-16 text-sm font-semibold"
              >
                <FileText className="w-4 h-4 mr-2" />
                Editar Prompts
              </Button>
              <Button
                variant={viewMode === 'view-full' ? 'default' : 'outline'}
                onClick={() => setViewMode('view-full')}
                className="h-16 text-sm font-semibold"
              >
                <Eye className="w-4 h-4 mr-2" />
                Ver Completo
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Settings */}
          <div className="lg:col-span-2 space-y-4">
            {viewMode === 'view-full' ? (
              /* Vista de Prompt Completo */
              <Card className="border-2 shadow-lg">
        <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-6 h-6 text-purple-600" />
                        Prompt Completo - {getShotTypeLabel(shotType).label}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        Este es el prompt completo que la IA recibirá, incluyendo el prompt base más todas tus personalizaciones
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={copyToClipboard}
                        className="gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        Copiar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={downloadPrompt}
                        className="gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Descargar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Prompt Base */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        Prompt Base (Hardcoded)
                      </label>
                      <Badge variant="outline">Solo lectura</Badge>
                    </div>
                    <Textarea 
                      value={getBasePromptText()}
                      readOnly
                      className="min-h-[400px] font-mono text-xs bg-slate-50 dark:bg-slate-900 resize-none"
                    />
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Este es el prompt base definido en el código. Para modificarlo, usa las secciones de personalización.
                    </p>
                  </div>

                  <div className="border-t-2 border-dashed pt-4"></div>

                  {/* Personalizaciones */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                      Tus Personalizaciones
                    </label>
                    
                    {(data.intro || data.fluidezHelp || data.setPointHelp || 
                      (data.categoryGuides && Object.keys(data.categoryGuides).length > 0) ||
                      (data.resources && data.resources.length > 0)) ? (
                      <div className="space-y-3">
                        {data.intro && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-3 rounded">
                            <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">📝 INSTRUCCIONES ADICIONALES:</div>
                            <div className="text-xs text-blue-900 dark:text-blue-100 font-mono whitespace-pre-wrap">{data.intro}</div>
                          </div>
                        )}

                        {data.fluidezHelp && (
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 p-3 rounded">
                            <div className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mb-1">⚡ GUÍA FLUIDEZ:</div>
                            <div className="text-xs text-yellow-900 dark:text-yellow-100 font-mono whitespace-pre-wrap">{data.fluidezHelp}</div>
                          </div>
                        )}

                        {data.setPointHelp && (
                          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 rounded">
                            <div className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">🎯 GUÍA SET POINT:</div>
                            <div className="text-xs text-red-900 dark:text-red-100 font-mono whitespace-pre-wrap">{data.setPointHelp}</div>
                          </div>
                        )}

                        {data.categoryGuides && Object.entries(data.categoryGuides).map(([cat, guide]) => (
                          guide?.guide && (
                            <div key={cat} className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 p-3 rounded">
                              <div className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">📚 {cat}:</div>
                              <div className="text-xs text-green-900 dark:text-green-100 font-mono whitespace-pre-wrap">{guide.guide}</div>
                              {guide.resources && guide.resources.length > 0 && (
                                <div className="text-xs text-green-700 dark:text-green-300 mt-2">
                                  Recursos: {guide.resources.join(', ')}
                                </div>
                              )}
                            </div>
                          )
                        ))}

                        {data.resources && data.resources.length > 0 && (
                          <div className="bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 p-3 rounded">
                            <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">📎 RECURSOS:</div>
                            <div className="text-xs text-purple-900 dark:text-purple-100 space-y-1">
                              {data.resources.map((r, i) => (
                                <div key={i} className="font-mono">- {r}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-slate-50 dark:bg-slate-800 rounded-lg border-2 border-dashed">
                        <Sparkles className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                        <p className="text-slate-600 dark:text-slate-400 font-medium">Sin personalizaciones</p>
                        <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                          Cambia a modo "Personalizar Prompt" para agregar configuraciones
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : viewMode === 'edit-prompts' ? (
              /* Vista de Edición de Prompts por Sección */
              <div className="space-y-4">
                <Card className="border-2 shadow-lg bg-amber-50 dark:bg-amber-900/10 border-amber-500">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-amber-900 dark:text-amber-100">⚠️ Modo Avanzado</p>
                        <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                          Aquí puedes <strong>sobrescribir completamente</strong> cada sección del prompt. 
                          Los cambios reemplazarán el prompt hardcodeado en el código.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Verificación */}
                <Card className="border-2 hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-blue-600" />
                        Verificación Inicial
                      </CardTitle>
                      {data.sectionPrompts?.verificacion && <Badge>Personalizado</Badge>}
                    </div>
                    <CardDescription>Preguntas de verificación y sistema de pesos</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-3 rounded">
                      <strong>Prompt por defecto:</strong>
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">
                        {getDefaultSectionPrompts().verificacion}
                      </pre>
                    </div>
                    <Textarea
                      value={data.sectionPrompts?.verificacion || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        sectionPrompts: { ...(prev.sectionPrompts || {}), verificacion: e.target.value }
                      }))}
                      placeholder="Deja vacío para usar el prompt por defecto, o escribe tu versión personalizada..."
                      className="min-h-[150px] font-mono text-xs"
                    />
                  </CardContent>
                </Card>

                {/* Preparación */}
                <Card className="border-2 hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-green-600" />
                        Preparación (6 parámetros)
                      </CardTitle>
                      {data.sectionPrompts?.preparacion && <Badge>Personalizado</Badge>}
                    </div>
                    <CardDescription>Alineación pies, cuerpo, muñeca, rodillas, hombros, enfoque visual</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-3 rounded">
                      <strong>Prompt por defecto:</strong>
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">
                        {getDefaultSectionPrompts().preparacion}
                      </pre>
                    </div>
                    <Textarea
                      value={data.sectionPrompts?.preparacion || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        sectionPrompts: { ...(prev.sectionPrompts || {}), preparacion: e.target.value }
                      }))}
                      placeholder="Deja vacío para usar el prompt por defecto..."
                      className="min-h-[150px] font-mono text-xs"
                    />
                  </CardContent>
                </Card>

                {/* Ascenso */}
                <Card className="border-2 hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <ChevronUp className="w-5 h-5 text-orange-600" />
                        Ascenso (7 parámetros)
                      </CardTitle>
                      {data.sectionPrompts?.ascenso && <Badge>Personalizado</Badge>}
                    </div>
                    <CardDescription>Mano no dominante, codos, ángulo estable, subida balón, trayectoria, set point, tiempo</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-3 rounded">
                      <strong>Prompt por defecto:</strong>
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">
                        {getDefaultSectionPrompts().ascenso}
                      </pre>
                    </div>
                    <Textarea
                      value={data.sectionPrompts?.ascenso || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        sectionPrompts: { ...(prev.sectionPrompts || {}), ascenso: e.target.value }
                      }))}
                      placeholder="Deja vacío para usar el prompt por defecto..."
                      className="min-h-[150px] font-mono text-xs"
                    />
                  </CardContent>
                </Card>

                {/* Fluidez */}
                <Card className="border-2 hover:shadow-lg transition-shadow border-yellow-500">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-600" />
                        Fluidez (2 parámetros) - PESO 47.5%
                      </CardTitle>
                      {data.sectionPrompts?.fluidez && <Badge className="bg-yellow-500">Personalizado</Badge>}
                    </div>
                    <CardDescription>Tiro en un solo tiempo, sincronía con piernas (CRÍTICO)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-3 rounded">
                      <strong>Prompt por defecto:</strong>
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">
                        {getDefaultSectionPrompts().fluidez}
                      </pre>
                    </div>
                    <Textarea
                      value={data.sectionPrompts?.fluidez || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        sectionPrompts: { ...(prev.sectionPrompts || {}), fluidez: e.target.value }
                      }))}
                      placeholder="Deja vacío para usar el prompt por defecto..."
                      className="min-h-[120px] font-mono text-xs"
                    />
                  </CardContent>
                </Card>

                {/* Liberación */}
                <Card className="border-2 hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-red-600" />
                        Liberación (4 parámetros)
                      </CardTitle>
                      {data.sectionPrompts?.liberacion && <Badge>Personalizado</Badge>}
                    </div>
                    <CardDescription>Mano no dominante, extensión brazo, giro pelota, ángulo salida</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-3 rounded">
                      <strong>Prompt por defecto:</strong>
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">
                        {getDefaultSectionPrompts().liberacion}
                      </pre>
                    </div>
                    <Textarea
                      value={data.sectionPrompts?.liberacion || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        sectionPrompts: { ...(prev.sectionPrompts || {}), liberacion: e.target.value }
                      }))}
                      placeholder="Deja vacío para usar el prompt por defecto..."
                      className="min-h-[120px] font-mono text-xs"
                    />
                  </CardContent>
                </Card>

                {/* Seguimiento */}
                <Card className="border-2 hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-purple-600" />
                        Seguimiento / Post-Liberación (4 parámetros)
                      </CardTitle>
                      {data.sectionPrompts?.seguimiento && <Badge>Personalizado</Badge>}
                    </div>
                    <CardDescription>Equilibrio, aterrizaje, follow-through, consistencia</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-3 rounded">
                      <strong>Prompt por defecto:</strong>
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">
                        {getDefaultSectionPrompts().seguimiento}
                      </pre>
                    </div>
                    <Textarea
                      value={data.sectionPrompts?.seguimiento || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        sectionPrompts: { ...(prev.sectionPrompts || {}), seguimiento: e.target.value }
                      }))}
                      placeholder="Deja vacío para usar el prompt por defecto..."
                      className="min-h-[120px] font-mono text-xs"
                    />
                  </CardContent>
                </Card>

                {/* Formato de Respuesta */}
                <Card className="border-2 hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" />
                        Formato de Respuesta
                      </CardTitle>
                      {data.sectionPrompts?.formatoRespuesta && <Badge>Personalizado</Badge>}
                    </div>
                    <CardDescription>Reglas, palabras prohibidas y requeridas</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-3 rounded">
                      <strong>Prompt por defecto:</strong>
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-xs">
                        {getDefaultSectionPrompts().formatoRespuesta}
                      </pre>
                    </div>
                    <Textarea
                      value={data.sectionPrompts?.formatoRespuesta || ''}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        sectionPrompts: { ...(prev.sectionPrompts || {}), formatoRespuesta: e.target.value }
                      }))}
                      placeholder="Deja vacío para usar el prompt por defecto..."
                      className="min-h-[120px] font-mono text-xs"
                    />
                  </CardContent>
                </Card>
              </div>
            ) : (
              /* Vista de Personalización - contenido existente */
              <>
            {/* Intro Section */}
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                onClick={() => toggleSection('intro')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <CardTitle>Introducción Personalizada</CardTitle>
                    {data.intro?.trim() && <Badge variant="default" className="ml-2">Configurado</Badge>}
                  </div>
                  {expandedSections.intro ? <ChevronUp /> : <ChevronDown />}
                </div>
                <CardDescription>
                  Instrucciones generales que se añadirán al inicio del prompt
                </CardDescription>
              </CardHeader>
              {expandedSections.intro && (
                <CardContent className="space-y-3">
                  <Textarea 
                    value={data.intro || ''} 
                    onChange={e => setData(prev => ({...prev, intro: e.target.value}))}
                    placeholder="Ej: Para tiros de tres puntos, presta especial atención a la elevación del brazo y el ángulo de salida..."
                    className="min-h-[120px] font-mono text-sm"
                  />
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <AlertCircle className="w-4 h-4" />
                    <span>Este texto se mostrará al inicio del análisis de la IA</span>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Fluidez Section */}
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                onClick={() => toggleSection('fluidez')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    <CardTitle>Guía sobre Fluidez</CardTitle>
                    {data.fluidezHelp?.trim() && <Badge variant="default" className="ml-2">Configurado</Badge>}
                  </div>
                  {expandedSections.fluidez ? <ChevronUp /> : <ChevronDown />}
                </div>
                <CardDescription>
                  Instrucciones específicas para evaluar la fluidez del movimiento (Peso: 47.5%)
                </CardDescription>
              </CardHeader>
              {expandedSections.fluidez && (
                <CardContent className="space-y-3">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-3">
                    <div className="flex items-start gap-2">
                      <Zap className="w-4 h-4 text-yellow-600 mt-0.5" />
                      <span className="text-xs text-yellow-800 dark:text-yellow-200">
                        <strong>Peso Crítico:</strong> La fluidez representa el 47.5% del score total. Las instrucciones aquí son cruciales.
                      </span>
                    </div>
                  </div>
                  <Textarea 
                    value={data.fluidezHelp || ''} 
                    onChange={e => setData(prev => ({...prev, fluidezHelp: e.target.value}))}
                    placeholder="Ej: Observa cuidadosamente si hay pausas entre la flexión y la extensión. Un tiro fluido debe ser un movimiento continuo..."
                    className="min-h-[120px] font-mono text-sm"
                  />
                </CardContent>
              )}
            </Card>

            {/* Set Point Section */}
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                onClick={() => toggleSection('setPoint')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-red-600" />
                    <CardTitle>Guía sobre Set Point</CardTitle>
                    {data.setPointHelp?.trim() && <Badge variant="default" className="ml-2">Configurado</Badge>}
                  </div>
                  {expandedSections.setPoint ? <ChevronUp /> : <ChevronDown />}
                </div>
                <CardDescription>
                  Instrucciones específicas para evaluar el set point (Peso: 7.86%)
                </CardDescription>
              </CardHeader>
              {expandedSections.setPoint && (
                <CardContent className="space-y-3">
                  <Textarea 
                    value={data.setPointHelp || ''} 
                    onChange={e => setData(prev => ({...prev, setPointHelp: e.target.value}))}
                    placeholder="Ej: El set point ideal debe estar por encima de la cabeza, con el codo formando un ángulo de 90°..."
                    className="min-h-[120px] font-mono text-sm"
                  />
                </CardContent>
              )}
            </Card>

            {/* Resources Section */}
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                onClick={() => toggleSection('resources')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <LinkIcon className="w-5 h-5 text-purple-600" />
                    <CardTitle>Recursos de Referencia</CardTitle>
                    {data.resources && data.resources.length > 0 && (
                      <Badge variant="outline" className="ml-2">{data.resources.length} recursos</Badge>
                    )}
                  </div>
                  {expandedSections.resources ? <ChevronUp /> : <ChevronDown />}
                </div>
                <CardDescription>
                  URLs de imágenes, videos o documentación de referencia
                </CardDescription>
        </CardHeader>
              {expandedSections.resources && (
        <CardContent className="space-y-3">
                  <Textarea 
                    value={(data.resources || []).join('\n')} 
                    onChange={e => setData(prev => ({
                      ...prev, 
                      resources: e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
                    }))}
                    placeholder="https://ejemplo.com/imagen1.jpg&#10;https://ejemplo.com/video-tecnica.mp4&#10;Una URL por línea"
                    className="min-h-[100px] font-mono text-sm"
                  />
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <AlertCircle className="w-4 h-4" />
                    <span>Ingresa una URL por línea</span>
          </div>
                </CardContent>
              )}
            </Card>

            {/* Category Guides Section */}
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                onClick={() => toggleSection('categories')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-green-600" />
                    <CardTitle>Guías por Categoría</CardTitle>
                    {data.categoryGuides && Object.keys(data.categoryGuides).length > 0 && (
                      <Badge variant="outline" className="ml-2">
                        {Object.values(data.categoryGuides).filter(g => g?.guide?.trim()).length} configuradas
                      </Badge>
                    )}
          </div>
                  {expandedSections.categories ? <ChevronUp /> : <ChevronDown />}
          </div>
                <CardDescription>
                  Instrucciones específicas para cada categoría del checklist
                </CardDescription>
              </CardHeader>
              {expandedSections.categories && (
                <CardContent className="space-y-4">
                  {/* Add Category */}
                  <div className="flex items-center gap-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <Input 
                      placeholder="Nombre de categoría" 
                      value={newCategory} 
                      onChange={(e) => setNewCategory(e.target.value)} 
                      className="flex-1"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => {
                        const cat = newCategory.trim();
                        if (!cat) return;
                        if (!categories.includes(cat)) setCategories(prev => [...prev, cat]);
                        setData(prev => ({ 
                          ...prev, 
                          categoryGuides: { 
                            ...(prev.categoryGuides || {}), 
                            [cat]: prev.categoryGuides?.[cat] || { guide: '', resources: [] }
                          }
                        }));
                        setNewCategory("");
                      }}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar
                    </Button>
          </div>

                  {/* Category List */}
            <div className="space-y-3">
              {categories.map((cat) => {
                const cg = data.categoryGuides?.[cat] || {};
                return (
                        <div key={cat} className="border-2 rounded-lg p-4 space-y-3 bg-white dark:bg-slate-900">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold flex items-center gap-2">
                              <span className="text-lg">📋</span>
                              {cat}
                              {cg.guide?.trim() && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            </div>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => {
                                setCategories(prev => prev.filter(c => c !== cat));
                                setData(prev => {
                                  const newGuides = { ...(prev.categoryGuides || {}) };
                                  delete newGuides[cat];
                                  return { ...prev, categoryGuides: newGuides };
                                });
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                      <Textarea
                        value={cg.guide || ''}
                            onChange={(e) => setData(prev => ({
                          ...prev,
                          categoryGuides: { 
                                ...(prev.categoryGuides || {}),
                                [cat]: { ...(prev.categoryGuides?.[cat] || {}), guide: e.target.value }
                          }
                        }))}
                            placeholder={`Instrucciones específicas para ${cat}...`}
                            className="text-sm font-mono"
                      />
                      <Textarea
                            value={(cg.resources || []).join('\n')}
                            onChange={(e) => setData(prev => ({
                          ...prev,
                          categoryGuides: {
                                ...(prev.categoryGuides || {}),
                                [cat]: { 
                                  ...(prev.categoryGuides?.[cat] || {}), 
                                  resources: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) 
                                }
                          }
                        }))}
                            placeholder="URLs de recursos (una por línea)"
                            className="text-xs font-mono min-h-[60px]"
                      />
                  </div>
                );
              })}
                    {categories.length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No hay categorías configuradas</p>
                        <p className="text-sm">Agrega una categoría para empezar</p>
            </div>
                    )}
            </div>
                </CardContent>
              )}
            </Card>
            </>
            )}
          </div>

          {/* Right Column - Actions & Preview */}
          <div className="space-y-4">
            {/* Save Card */}
            <Card className="border-2 shadow-lg sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Save className="w-5 h-5" />
                  Acciones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={save} 
                  disabled={saving}
                  className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                      Guardando...
                    </>
                  ) : saved ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      ¡Guardado!
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Guardar Cambios
                    </>
                  )}
                </Button>

                <Button 
                  onClick={() => setShowPreview(!showPreview)}
                  variant="outline"
                  className="w-full"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {showPreview ? 'Ocultar' : 'Ver'} Preview
                </Button>

                <div className="pt-3 border-t space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Tipo de tiro:</span>
                    <Badge>{getShotTypeLabel(shotType).label}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Items configurados:</span>
                    <Badge variant="outline">{countConfiguredItems()}</Badge>
                  </div>
          </div>
        </CardContent>
      </Card>

            {/* Preview Card */}
            {showPreview && (
              <Card className="border-2 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Preview del Prompt
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-slate-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 font-mono whitespace-pre-wrap">
                    {generatePreview()}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Help Card */}
            <Card className="border-2 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-blue-900 dark:text-blue-100 flex items-center gap-2 text-base">
                  <AlertCircle className="w-5 h-5" />
                  Ayuda
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p><strong>💡 Tip:</strong> Las configuraciones se aplican automáticamente a los nuevos análisis.</p>
                <p><strong>⚡ Fluidez:</strong> Es el parámetro más importante (47.5% del score).</p>
                <p><strong>🎯 Set Point:</strong> Afecta 7.86% del score total.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

