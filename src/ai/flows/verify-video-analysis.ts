export async function verifyVideoAnalysis(input: { videoUrl: string }) {
  return {
    ok: true,
    videoUrl: input.videoUrl,
  };
}
