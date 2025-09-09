"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Keypoint { name: string; x: number; y: number; v?: number }
interface Frame { index: number; time_sec: number; keypoints: Keypoint[] }

export default function UploadAnalyzePage() {
	const [fileName, setFileName] = useState<string>("");
	const [frames, setFrames] = useState<Frame[] | null>(null);
	const [result, setResult] = useState<any>(null);
	const [busy, setBusy] = useState(false);

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

	async function analyze() {
		if (!frames) return alert("Cargá un JSON primero");
		setBusy(true);
		try {
			const res = await fetch("/api/analyze", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ frames }),
			});
			const data = await res.json();
			setResult(data);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="p-6 space-y-6">
			<h1 className="text-xl font-semibold">Subir JSON y analizar</h1>
			<div className="space-y-2">
				<Input type="file" accept="application/json" onChange={onFile} />
				{frames && (
					<div className="text-sm text-muted-foreground">
						{fileName} — {frames.length} frames
					</div>
				)}
			</div>
			<div className="flex gap-3">
				<Button onClick={analyze} disabled={!frames || busy}>
					{busy ? "Analizando..." : "Analizar"}
				</Button>
			</div>
			{result && (
				<div className="rounded border p-4 bg-white">
					<h2 className="font-medium mb-2">Resultado</h2>
					<pre className="whitespace-pre-wrap text-sm">{JSON.stringify(result, null, 2)}</pre>
				</div>
			)}
		</div>
	);
}
