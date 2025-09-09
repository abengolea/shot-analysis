import { NextRequest, NextResponse } from "next/server";
import { runModelOrHeuristic } from "@/lib/onnx-inference";

// Types
interface Keypoint {
	name: string;
	x: number;
	y: number;
	v?: number;
}

interface Frame {
	index: number;
	time_sec: number;
	keypoints: Keypoint[];
}

interface AnalyzePayload {
	version?: number;
	fps?: number;
	frames: Frame[];
}

export async function POST(req: NextRequest) {
	try {
		const body = (await req.json()) as AnalyzePayload;
		if (!body || !Array.isArray(body.frames) || body.frames.length === 0) {
			return NextResponse.json({ error: "Invalid payload: frames required" }, { status: 400 });
		}

		// When available, set model path via env or config
		const modelPath = process.env.TCN_ONNX_PATH;
		const result = await runModelOrHeuristic(body.frames, modelPath);

		return NextResponse.json({ ok: true, result });
	} catch (err) {
		console.error("/api/analyze error", err);
		return NextResponse.json({ error: "Internal error" }, { status: 500 });
	}
}
