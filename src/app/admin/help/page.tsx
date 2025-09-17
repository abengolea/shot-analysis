"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminHelpPage() {
	return (
		<div className="p-6 space-y-4">
			<h1 className="text-xl font-semibold">Ayuda</h1>
			<p className="text-sm text-muted-foreground">
				Manual de operador, guía de etiquetado y manual técnico, todo en una sola página.
			</p>

			<Tabs defaultValue="operador" className="w-full">
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="operador">Manual de Operador</TabsTrigger>
					<TabsTrigger value="etiquetado">Guía de Etiquetado</TabsTrigger>
					<TabsTrigger value="tecnico">Manual Técnico</TabsTrigger>
					<TabsTrigger value="alta-coaches">Alta de Entrenadores</TabsTrigger>
				</TabsList>

				<TabsContent value="operador" className="mt-4 space-y-4">
					<h2 className="text-lg font-medium">Uso básico</h2>
					<ol className="list-decimal pl-6 space-y-1 text-sm">
						<li>Subí el video del tiro (buena luz, cuerpo completo).</li>
						<li>Esperá el procesamiento y abrí el análisis.</li>
						<li>Leé el resumen, puntos a mejorar e indicaciones.</li>
					</ol>
					<h3 className="font-medium">Opcional: Etiquetar para mejorar el sistema</h3>
					<ol className="list-decimal pl-6 space-y-1 text-sm">
						<li>Ir a Admin → Herramienta de etiquetado.</li>
						<li>Cargar el archivo JSON de keypoints.</li>
						<li>Ingresar el momento del release (segundos) y ajustar la ventana.</li>
						<li>Marcar etiquetas y ajustar métricas si corresponde.</li>
						<li>Exportar etiquetado.</li>
					</ol>
					<h3 className="font-medium">Problemas comunes</h3>
					<ul className="list-disc pl-6 space-y-1 text-sm">
						<li>No aparece nada: refrescá y verificá conexión.</li>
						<li>“JSON inválido”: regenerá el archivo o pedí ayuda al técnico.</li>
						<li>Video oscuro/lejos: repetí con mejor luz y encuadre.</li>
					</ul>
				</TabsContent>

				<TabsContent value="etiquetado" className="mt-4 space-y-4">
					<h2 className="text-lg font-medium">Taxonomía (MVP)</h2>
					<ul className="list-disc pl-6 space-y-1 text-sm">
						<li><strong>baja_transferencia</strong>: cadena piernas→tronco→brazo→muñeca no fluye al release.</li>
						<li><strong>muneca_adelantada</strong>: la muñeca rompe antes de tiempo respecto al codo/brazo.</li>
						<li><strong>pickup_inconsistente</strong>: toma de pelota inestable o fuera del eje.</li>
						<li><strong>brazo_no_alineado</strong>: codo‑muñeca‑pelota no alineados al aro.</li>
					</ul>
					<h3 className="font-medium">Métricas</h3>
					<ul className="list-disc pl-6 space-y-1 text-sm">
						<li><strong>ITE (0–100)</strong>: índice de transferencia de energía.</li>
						<li><strong>delay_ms</strong>: diferencia entre pico de cadera/rodilla y muñeca/codo.</li>
					</ul>
					<h3 className="font-medium">Criterios rápidos</h3>
					<ul className="list-disc pl-6 space-y-1 text-sm">
						<li>baja_transferencia si el delay_ms &gt; 150 ms o extensión no es continua.</li>
						<li>muneca_adelantada si la muñeca flexiona antes del pico del codo.</li>
						<li>pickup_inconsistente si hay inestabilidad lateral/rotacional evidente.</li>
						<li>brazo_no_alineado si el vector codo→muñeca no apunta al aro en la subida.</li>
					</ul>
					<h3 className="font-medium">Paso a paso</h3>
					<ol className="list-decimal pl-6 space-y-1 text-sm">
						<li>Cargar JSON, setear release y ventana.</li>
						<li>Observar muñeca/codo/hombros; evaluar continuidad.</li>
						<li>Marcar etiquetas y fijar métricas (ITE, delay_ms).</li>
						<li>Exportar etiquetado.</li>
					</ol>
				</TabsContent>

				<TabsContent value="tecnico" className="mt-4 space-y-4">
					<h2 className="text-lg font-medium">Entrenamiento y despliegue (resumen)</h2>
					<ol className="list-decimal pl-6 space-y-1 text-sm">
						<li>Instalar dependencias en <code>ml/</code> (venv + pip install -r requirements.txt).</li>
						<li>Extraer keypoints (individual o batch).</li>
						<li>Crear dataset etiquetado (admin o script de ventana).</li>
						<li>Entrenar TCN: <code>python train_tcn.py --data_dir C:\\ml_data</code>.</li>
						<li>Exportar ONNX: <code>python export_onnx.py --checkpoint ... --output ...</code>.</li>
						<li>Configurar <code>TCN_ONNX_PATH</code> y probar <code>/api/analyze</code>.</li>
					</ol>
					<p className="text-sm text-muted-foreground">
						Ver detalles en el manual técnico si hace falta.
					</p>
				</TabsContent>

				<TabsContent value="alta-coaches" className="mt-4 space-y-4">
					<h2 className="text-lg font-medium">Alta de entrenadores (solo admin)</h2>
					<ol className="list-decimal pl-6 space-y-1 text-sm">
						<li>Desde <code>/coach-register</code> con sesión de admin, completa nombre, email, bio y foto (obligatoria).</li>
						<li>Abre el detalle del coach en Admin → Coaches y revisa los datos.</li>
						<li>Pulsa <strong>Dar alta + enviar contraseña</strong> para activarlo y enviar el email con el enlace de contraseña.</li>
						<li>Confirmá que el coach ingresó y completó su perfil (opcionalmente ajusta visibilidad pública).</li>
					</ol>
					<p className="text-sm text-muted-foreground">Notas: si el email ya existe en Auth, se vincula. La visibilidad pública queda activa desde el alta.</p>
				</TabsContent>
			</Tabs>
		</div>
	);
}
