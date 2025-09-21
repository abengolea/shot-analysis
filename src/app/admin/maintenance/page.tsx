"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, RefreshCw } from 'lucide-react';

interface MaintenanceConfig {
  enabled: boolean;
  title: string;
  message: string;
  updatedAt: string;
  updatedBy: string;
}

export default function MaintenancePage() {
  const [config, setConfig] = useState<MaintenanceConfig>({
    enabled: false,
    title: '🔧 SITIO EN MANTENIMIENTO',
    message: 'Estamos ajustando variables importantes del sistema.\n\nEl análisis de lanzamientos está temporalmente deshabilitado.\n\nVolveremos pronto con mejoras. ¡Gracias por tu paciencia!',
    updatedAt: '',
    updatedBy: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Cargar configuración actual
  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/maintenance');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la configuración de mantenimiento',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Guardar configuración
  const saveConfig = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          updatedBy: 'admin' // Aquí podrías usar el usuario actual
        })
      });

      if (response.ok) {
        const result = await response.json();
        setConfig(result.config);
        toast({
          title: 'Éxito',
          description: result.message,
          variant: 'default'
        });
      } else {
        throw new Error('Error al guardar');
      }
    } catch (error) {
      console.error('Error guardando configuración:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando configuración...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Configuración de Mantenimiento</h1>
        <p className="text-muted-foreground mt-2">
          Controla cuándo mostrar el mensaje de mantenimiento a los usuarios
        </p>
      </div>

      <div className="grid gap-6">
        {/* Estado Actual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${config.enabled ? 'bg-red-500' : 'bg-green-500'}`} />
              Estado Actual
            </CardTitle>
            <CardDescription>
              El mantenimiento está actualmente {config.enabled ? 'HABILITADO' : 'DESHABILITADO'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Switch
                id="maintenance-enabled"
                checked={config.enabled}
                onCheckedChange={(enabled) => setConfig(prev => ({ ...prev, enabled }))}
              />
              <Label htmlFor="maintenance-enabled" className="text-sm font-medium">
                {config.enabled ? 'Mantenimiento ACTIVO' : 'Mantenimiento INACTIVO'}
              </Label>
            </div>
            {config.enabled && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm font-medium">
                  ⚠️ Los usuarios NO pueden analizar lanzamientos mientras esté activo
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuración del Mensaje */}
        <Card>
          <CardHeader>
            <CardTitle>Mensaje de Mantenimiento</CardTitle>
            <CardDescription>
              Personaliza el título y mensaje que verán los usuarios
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={config.title}
                onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
                placeholder="🔧 SITIO EN MANTENIMIENTO"
              />
            </div>
            <div>
              <Label htmlFor="message">Mensaje</Label>
              <Textarea
                id="message"
                value={config.message}
                onChange={(e) => setConfig(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Mensaje que verán los usuarios..."
                rows={6}
              />
            </div>
          </CardContent>
        </Card>

        {/* Vista Previa */}
        <Card>
          <CardHeader>
            <CardTitle>Vista Previa</CardTitle>
            <CardDescription>
              Así verán el mensaje los usuarios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-6 border rounded-lg bg-card">
              <h3 className="text-lg font-semibold mb-2">{config.title}</h3>
              <div className="text-sm text-muted-foreground whitespace-pre-line">
                {config.message}
              </div>
              <Button className="mt-4" variant="outline" size="sm">
                Entendido
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Información */}
        {config.updatedAt && (
          <Card>
            <CardHeader>
              <CardTitle>Información</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <p>Última actualización: {new Date(config.updatedAt).toLocaleString('es-ES')}</p>
                <p>Actualizado por: {config.updatedBy}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Acciones */}
        <div className="flex gap-4">
          <Button onClick={saveConfig} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Configuración
              </>
            )}
          </Button>
          <Button variant="outline" onClick={loadConfig} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Recargar
          </Button>
        </div>
      </div>
    </div>
  );
}

