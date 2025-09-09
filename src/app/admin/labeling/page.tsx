"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface Keypoint { name: string; x: number; y: number; v?: number }
interface Frame { index: number; time_sec: number; keypoints: Keypoint[] }

export default function LabelingPage() {
	const [fileName, setFileName] = useState<string>("");
	const [frames, setFrames] = useState<Frame[] | null>(null);
	const [labels, setLabels] = useState<{ [k: string]: boolean }>({
		baja_transferencia: false,
		muneca_adelantada: false,
		pickup_inconsistente: false,
		brazo_no_alineado: false,
	});
	const [ite, setIte] = useState<number>(50);
	const [delayMs, setDelayMs] = useState<number>(0);

	// Recorte por ventana centrada en release
	const [releaseSec, setReleaseSec] = useState<number>(0);
	const [preMs, setPreMs] = useState<number>(500);
	const [postMs, setPostMs] = useState<number>(200);

	function onFile(e: React.ChangeEvent<HTMLInputElement>) {
		const f = e.target.files?.[0];
		if (!f) return;
		setFileName(f.name);
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const data = JSON.parse(String(reader.result || "{}"));
				if (Array.isArray(data.frames)) setFrames(data.frames);
				else alert("JSON inválido: falta frames");
			} catch (err) {
				alert("No se pudo parsear JSON");
			}
		};
		reader.readAsText(f);
	}

	function toggleLabel(k: string) {
		setLabels((prev) => ({ ...prev, [k]: !prev[k] }));
	}

	function cropByWindow(allFrames: Frame[], release_time_sec: number, pre_ms: number, post_ms: number): Frame[] {
		const start = release_time_sec - pre_ms / 1000;
		const end = release_time_sec + post_ms / 1000;
		return allFrames.filter((fr) => fr.time_sec >= start && fr.time_sec <= end);
	}

	function exportLabeled() {
		if (!frames) return alert("Cargá un JSON primero");
		const windowed = cropByWindow(frames, releaseSec, preMs, postMs);
		const out = {
			version: 1,
			source: fileName,
			frames: windowed,
			window: { release_time_sec: releaseSec, pre_ms: preMs, post_ms: postMs },
			labels,
			targets: { ite, delay_ms: delayMs },
		};
		const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = fileName.replace(/\.json$/i, "") + ".labeled.json";
		a.click();
	}

	async function analyze() {
		if (!frames) return alert("Cargá un JSON primero");
		const windowed = cropByWindow(frames, releaseSec, preMs, postMs);
		const res = await fetch("/api/analyze", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ frames: windowed }),
		});
		const data = await res.json();
		alert(JSON.stringify(data, null, 2));
	}

	return (
		<div className="p-6 space-y-6">
			<h1 className="text-xl font-semibold">Herramienta mínima de etiquetado</h1>
			<div className="rounded border bg-muted/30 p-3 text-sm text-muted-foreground">
				Consulta la guía de etiquetado para criterios y ejemplos: <a className="underline" href="/docs/labeling-guidelines" target="_blank" rel="noreferrer">docs/labeling-guidelines</a>
			</div>
			<div className="space-y-2">
				<Label>Subir JSON de keypoints</Label>
				<Input type="file" accept="application/json" onChange={onFile} />
				{frames && (
					<div className="text-sm text-muted-foreground">
						{fileName} — {frames.length} frames
					</div>
				)}
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div className="space-y-3">
					<h2 className="font-medium">Etiquetas (multi-etiqueta)</h2>
					{Object.keys(labels).map((k) => (
						<label key={k} className="flex items-center gap-2">
							<input type="checkbox" checked={labels[k]} onChange={() => toggleLabel(k)} />
							<span>{k}</span>
						</label>
					))}
				</div>
				<div className="space-y-4">
					<h2 className="font-medium">Métricas</h2>
					<div>
						<Label>ITE</Label>
						<Slider value={[ite]} onValueChange={(v) => setIte(v[0] ?? 0)} min={0} max={100} step={1} />
						<div className="text-sm">{ite}</div>
					</div>
					<div>
						<Label>Delay (ms)</Label>
						<Input type="number" value={delayMs} onChange={(e) => setDelayMs(parseInt(e.target.value || "0", 10))} />
					</div>
				</div>
				<div className="space-y-4">
					<h2 className="font-medium">Ventana alrededor del release</h2>
					<div>
						<Label>Release (segundos)</Label>
						<Input type="number" step="0.01" value={releaseSec} onChange={(e) => setReleaseSec(parseFloat(e.target.value || "0"))} />
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<Label>Pre (ms)</Label>
							<Input type="number" value={preMs} onChange={(e) => setPreMs(parseInt(e.target.value || "0", 10))} />
						</div>
						<div>
							<Label>Post (ms)</Label>
							<Input type="number" value={postMs} onChange={(e) => setPostMs(parseInt(e.target.value || "0", 10))} />
						</div>
					</div>
				</div>
			</div>

			<div className="flex gap-3">
				<Button onClick={exportLabeled} variant="default">Exportar etiquetado</Button>
				<Button onClick={analyze} variant="secondary">Analizar (endpoint)</Button>
			</div>
		</div>
	);
}
