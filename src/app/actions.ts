"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { analyzeBasketballShot, type AnalyzeBasketballShotOutput } from "@/ai/flows/analyze-basketball-shot";
import { generatePersonalizedDrills, type GeneratePersonalizedDrillsOutput } from "@/ai/flows/generate-personalized-drills";
import { moderateContent } from '@/ai/flows/content-moderation';
import { mockAnalyses } from "@/lib/mock-data";

const analysisSchema = z.object({
  playerId: z.string(),
  ageGroup: z.enum(['U10', 'U13', 'U15', 'U18', 'Amateur', 'SemiPro', 'Pro']),
  playerLevel: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  shotType: z.enum(['Free Throw', 'Mid-Range', 'Three-Pointer', 'Layup']),
});

// This is a placeholder for a database write
async function saveAnalysis(analysisData: any) {
  console.log("Saving analysis data (mock):", analysisData);
  const newId = (mockAnalyses.length + 101).toString();
  const newAnalysis = {
      ...analysisData,
      id: newId,
      createdAt: new Date().toISOString(),
      // In a real app, keyframes would come from video processing
      keyframes: [
          "https://placehold.co/640x360.png",
          "https://placehold.co/640x360.png",
          "https://placehold.co/640x360.png",
          "https://placehold.co/640x360.png",
      ],
  };
  mockAnalyses.push(newAnalysis);
  return newAnalysis;
}


export async function startAnalysis(prevState: any, formData: FormData) {
  try {
    const validatedFields = analysisSchema.safeParse({
      playerId: formData.get("playerId"),
      ageGroup: formData.get("ageGroup"),
      playerLevel: formData.get("playerLevel"),
      shotType: formData.get("shotType"),
    });

    if (!validatedFields.success) {
      return { message: "Invalid form data.", errors: validatedFields.error.flatten().fieldErrors };
    }

    // In a real app, you would upload the video and get a URL.
    // For this demo, we'll use a placeholder.
    const videoUrl = "https://placehold.co/1280x720.png";

    const aiInput = {
      videoUrl,
      // The AI flow expects a different age category format.
      ageCategory: validatedFields.data.ageGroup === 'Amateur' ? 'Amateur adulto' : `Sub-${validatedFields.data.ageGroup.replace('U','')}` as any,
      playerLevel: validatedFields.data.playerLevel,
      shotType: validatedFields.data.shotType,
    };
    
    // For demonstration, we'll return a mock analysis immediately.
    // In a real app, you might call the AI flow like this:
    // const analysisResult: AnalyzeBasketballShotOutput = await analyzeBasketballShot(aiInput);
    const analysisResult: AnalyzeBasketballShotOutput = {
        analysisSummary: "This is a mock analysis. The player shows good potential but needs to work on their follow-through. The shot arc is a bit flat.",
        strengths: ["Good stance", "Quick release"],
        weaknesses: ["Flat arc", "Inconsistent follow-through"],
        recommendations: ["Practice shooting with more arc.", "Focus on holding the follow-through position."],
        keyframes: [],
    };
    
    const newAnalysisData = {
        playerId: validatedFields.data.playerId,
        shotType: validatedFields.data.shotType,
        ...analysisResult,
    };

    const savedAnalysis = await saveAnalysis(newAnalysisData);
    
    revalidatePath(`/players/${savedAnalysis.playerId}`);
    redirect(`/analysis/${savedAnalysis.id}`);

  } catch (error) {
    console.error("Analysis Error:", error);
    return { message: "Failed to start analysis. Please try again." };
  }
}

export async function getDrills(
    analysisSummary: string, 
    ageGroup: 'U10' | 'U13' | 'U15' | 'U18' | 'Amateur' | 'SemiPro' | 'Pro'
): Promise<{ drills?: GeneratePersonalizedDrillsOutput['drills']; error?: string }> {
    try {
        const result = await generatePersonalizedDrills({
            analysisJson: JSON.stringify({ summary: analysisSummary }),
            resources: "Cones, basketball, wall",
            ageGroup: ageGroup,
        });
        return { drills: result.drills };
    } catch (error) {
        console.error("Drill Generation Error:", error);
        return { error: "Failed to generate drills." };
    }
}

export async function moderateAndAddComment(prevState: any, formData: FormData) {
    const text = formData.get('comment') as string;
    const analysisId = formData.get('analysisId') as string;

    if (!text || text.trim().length === 0) {
        return { message: 'Comment cannot be empty.' };
    }

    try {
        const moderationResult = await moderateContent({ text });
        if (moderationResult.isHarmful) {
            return { message: `Comment could not be posted: ${moderationResult.reason}` };
        }

        // In a real app, you would save the comment to the database here.
        console.log(`(Mock) Adding comment to analysis ${analysisId}: "${text}"`);

        revalidatePath(`/analysis/${analysisId}`);
        return { message: 'Comment posted successfully.', comment: text };
    } catch (error) {
        console.error('Comment moderation error:', error);
        return { message: 'Failed to post comment.' };
    }
}
