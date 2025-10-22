import * as path from "path";

// Lazy import to avoid bundling issues when not present in environment
let ort: any = null;
try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	ort = require("onnxruntime-node");
} catch (e) {
	// Module not available, use fallback
	ort = null;
}

export type AnalyzeResult = {
	labels: string[];
	metrics: Record<string, number>;
	recommendations?: Array<{ id: string; title: string; description: string }>;
};

export async function runModelOrHeuristic(
	frames: Array<{ index: number; time_sec: number; keypoints: Array<{ name: string; x: number; y: number; v?: number }> }>,
	modelPath?: string
): Promise<AnalyzeResult> {
	if (!modelPath || !ort) {
		return heuristic(frames);
	}

	try {
		const session = await ort.InferenceSession.create(modelPath);
		// Build input tensor [1, T, 33, 3]
		const T = frames.length;
		const J = 33;
		const C = 3;
		const buf = new Float32Array(1 * T * J * C);
		const nameToIdx: Record<string, number> = {};
		frames[0].keypoints.forEach((kp, idx) => (nameToIdx[kp.name] = idx));
		for (let t = 0; t < T; t++) {
			for (let j = 0; j < J; j++) {
				const kp = frames[t].keypoints[j] || { x: 0, y: 0, v: 0 };
				const base = t * J * C + j * C;
				buf[base + 0] = kp.x;
				buf[base + 1] = kp.y;
				buf[base + 2] = kp.v ?? 0;
			}
		}
		const input = new ort.Tensor("float32", buf, [1, T, J, C]);
		const outputs = await session.run({ x: input });
		const logits = outputs["logits"]?.data as Float32Array | undefined;
		const preds = outputs["preds"]?.data as Float32Array | undefined;
		// Placeholder postproc: sigmoid for logits, direct for preds
		const labels: string[] = [];
		if (logits && logits.length >= 4) {
			const probs = Array.from(logits).map((v) => 1 / (1 + Math.exp(-v)));
			if (probs[0] > 0.5) labels.push("baja_transferencia");
			if (probs[1] > 0.5) labels.push("muneca_adelantada");
		}
		const metrics: Record<string, number> = {};
		if (preds && preds.length >= 2) {
			metrics["ite"] = Math.max(0, Math.min(100, Math.round(preds[0])));
			metrics["delay_ms"] = Math.round(preds[1]);
		}
		return { labels, metrics };
	} catch (e) {
		return heuristic(frames);
	}
}

function heuristic(frames: Array<{ keypoints: Array<{ name: string; x: number; y: number }> }>): AnalyzeResult {
	if (frames.length === 0) return { labels: [], metrics: {} };
	const nameToIdx: Record<string, number> = {};
	frames[0].keypoints.forEach((kp, idx) => (nameToIdx[kp.name] = idx));
	const ls = nameToIdx["left_shoulder"];
	const rs = nameToIdx["right_shoulder"];
	const rw = nameToIdx["right_wrist"];
	let maxExt = 0;
	for (const fr of frames) {
		const shoulderY = (fr.keypoints[ls]?.y + fr.keypoints[rs]?.y) / 2;
		const ext = Math.max(0, shoulderY - (fr.keypoints[rw]?.y ?? shoulderY));
		if (ext > maxExt) maxExt = ext;
	}
	const ite = Math.min(100, Math.max(0, Math.round(100 * maxExt)));
	const labels: string[] = [];
	if (ite < 30) labels.push("baja_transferencia");
	return { labels, metrics: { ite } };
}
