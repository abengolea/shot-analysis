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
  shotTypesMaintenance?: {
    tres: boolean;
    media: boolean;
    libre: boolean;
  };
}

export default function MaintenancePage() {
  const [config, setConfig] = useState<MaintenanceConfig>({
    enabled: false,
    title: '🔧 SITIO EN MANTENIMIENTO',
    message: 'Estamos ajustando variables importantes del sistema.\n\nEl análisis de lanzamientos está temporalmente deshabilitado.\n\nVolveremos pronto con mejoras. ¡Gracias por tu paciencia!',
    updatedAt: '',
    updatedBy: '',
    shotTypesMaintenance: {
      tres: false,
      media: false,
      libre: true
    }
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
        {/* Estado Actual - Mantenimiento General */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${config.enabled ? 'bg-red-500' : 'bg-green-500'}`} />
              Mantenimiento General
            </CardTitle>
            <CardDescription>
              Si está activo, toda la aplicación queda en mantenimiento (todos los tipos de tiro)
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
                {config.enabled ? 'Mantenimiento ACTIVO (Toda la app)' : 'Mantenimiento INACTIVO'}
              </Label>
            </div>
            {config.enabled && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm font-medium">
                  ⚠️ Los usuarios NO pueden analizar ningún tipo de tiro mientras esté activo
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mantenimiento por Tipo de Tiro */}
        {!config.enabled && (
          <Card>
            <CardHeader>
              <CardTitle>Mantenimiento por Tipo de Tiro</CardTitle>
              <CardDescription>
                Controla qué tipos de análisis están en mantenimiento de forma individual
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tiro de Tres Puntos */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <Label htmlFor="tres-maintenance" className="text-base font-medium cursor-pointer">
                    🏀 Lanzamiento de Tres Puntos
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Si está activo, los usuarios no pueden analizar tiros de tres puntos
                  </p>
                </div>
                <Switch
                  id="tres-maintenance"
                  checked={config.shotTypesMaintenance?.tres || false}
                  onCheckedChange={(enabled) => setConfig(prev => ({
                    ...prev,
                    shotTypesMaintenance: {
                      ...prev.shotTypesMaintenance,
                      tres: enabled
                    }
                  }))}
                />
              </div>

              {/* Tiro de Media Distancia */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <Label htmlFor="media-maintenance" className="text-base font-medium cursor-pointer">
                    🎯 Lanzamiento de Media Distancia (Jump Shot)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Si está activo, los usuarios no pueden analizar jump shots
                  </p>
                </div>
                <Switch
                  id="media-maintenance"
                  checked={config.shotTypesMaintenance?.media || false}
                  onCheckedChange={(enabled) => setConfig(prev => ({
                    ...prev,
                    shotTypesMaintenance: {
                      ...prev.shotTypesMaintenance,
                      media: enabled
                    }
                  }))}
                />
              </div>

              {/* Tiro Libre */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <Label htmlFor="libre-maintenance" className="text-base font-medium cursor-pointer">
                    🎲 Tiro Libre
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Si está activo, los usuarios no pueden analizar tiros libres
                  </p>
                </div>
                <Switch
                  id="libre-maintenance"
                  checked={config.shotTypesMaintenance?.libre || false}
                  onCheckedChange={(enabled) => setConfig(prev => ({
                    ...prev,
                    shotTypesMaintenance: {
                      ...prev.shotTypesMaintenance,
                      libre: enabled
                    }
                  }))}
                />
              </div>

              {(config.shotTypesMaintenance?.tres || config.shotTypesMaintenance?.media || config.shotTypesMaintenance?.libre) && (() => {
                const blockedTypes: string[] = [];
                const availableTypes: string[] = [];
                
                if (config.shotTypesMaintenance?.tres) blockedTypes.push('Lanzamiento de Tres');
                else availableTypes.push('Lanzamiento de Tres');
                
                if (config.shotTypesMaintenance?.media) blockedTypes.push('Lanzamiento de Media Distancia');
                else availableTypes.push('Lanzamiento de Media Distancia');
                
                if (config.shotTypesMaintenance?.libre) blockedTypes.push('Tiro Libre');
                else availableTypes.push('Tiro Libre');
                
                return (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                    <p className="text-amber-800 text-sm font-medium">
                      ⚠️ Tipos bloqueados ({blockedTypes.length}): {blockedTypes.join(', ')}
                    </p>
                    {availableTypes.length > 0 && (
                      <p className="text-amber-700 text-sm">
                        ✅ Tipos disponibles ({availableTypes.length}): {availableTypes.join(', ')}
                      </p>
                    )}
                    <p className="text-amber-700 text-xs mt-2">
                      Los usuarios verán un mensaje específico indicando qué tipo está bloqueado y cuáles están disponibles.
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Configuración del Mensaje */}
        <Card>
          <CardHeader>
            <CardTitle>Mensaje de Mantenimiento General</CardTitle>
            <CardDescription>
              {config.enabled 
                ? 'Personaliza el título y mensaje que verán los usuarios cuando toda la app esté en mantenimiento'
                : 'Estos mensajes solo se usan cuando el mantenimiento general está activo. Para tipos específicos, el sistema genera mensajes automáticos indicando qué tipos están disponibles.'}
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

