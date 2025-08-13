// src/ai/flows/generate-personalized-drills.ts
'use server';

/**
 * @fileOverview Generates personalized basketball drills based on player analysis.
 *
 * This file defines a Genkit flow that takes a player's shot analysis as input
 * and returns a set of tailored drills to improve their weaknesses.
 *
 * @fileOverview
 * - generatePersonalizedDrills - A function to generate personalized drills.
 * - GeneratePersonalizedDrillsInput - The input type for the generatePersonalizedDrills function.
 * - GeneratePersonalizedDrillsOutput - The return type for the generatePersonalizedDrills function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePersonalizedDrillsInputSchema = z.object({
  analysisJson: z.string().describe('JSON string containing the analysis of the player shot, including age, level, weaknesses, etc.'),
  resources: z.string().describe('Available resources like space and equipment (e.g., cones, resistance bands).'),
  ageGroup: z
    .enum([
      'U10',
      'U13',
      'U15',
      'U18',
      'Amateur',
      'SemiPro',
      'Pro',
    ])
    .describe('The age group of the player (e.g., U10, U13, U15, U18, Amateur, SemiPro, Pro).'),
});

export type GeneratePersonalizedDrillsInput = z.infer<
  typeof GeneratePersonalizedDrillsInputSchema
>;

const DrillSchema = z.object({
  name: z.string().describe('The name of the drill.'),
  targetIssue: z.string().describe('The specific issue the drill is designed to address.'),
  instructions: z.array(z.string()).describe('Step-by-step instructions for performing the drill.'),
  setsReps: z.string().describe('The recommended sets and repetitions for the drill.'),
  progression: z.string().describe('How to make the drill more challenging.'),
  successCriteria: z.string().describe('Observable metrics for determining the success of the drill.'),
  safety: z.string().describe('Safety warnings for the drill (if applicable).'),
  ageVariants: z
    .record(z.string(), z.string())
    .optional()
    .describe('Variations of the drill based on age group (optional).'),
});

const GeneratePersonalizedDrillsOutputSchema = z.object({
  drills: z.array(DrillSchema).describe('A list of personalized drills.'),
});

export type GeneratePersonalizedDrillsOutput = z.infer<
  typeof GeneratePersonalizedDrillsOutputSchema
>;

async function generatePersonalizedDrills(
  input: GeneratePersonalizedDrillsInput
): Promise<GeneratePersonalizedDrillsOutput> {
  return generatePersonalizedDrillsFlow(input);
}

const generatePersonalizedDrillsPrompt = ai.definePrompt({
  name: 'generatePersonalizedDrillsPrompt',
  input: {schema: GeneratePersonalizedDrillsInputSchema},
  output: {schema: GeneratePersonalizedDrillsOutputSchema},
  prompt: `You are an expert basketball coach AI assistant. Based on the player's analysis, their age group and available resources, generate a set of personalized drills.

Follow these rules:

*   Prioritize the issues detected in the analysis. If no specific issues are mentioned, generate general skill-enhancement drills.
*   Include progression and measurable success criteria for each drill.
*   Use the specified age group to make sure that the drills are age appropriate.
*   Consider the available resources and only suggest drills that can be performed with those resources.

Here is the analysis JSON: {{{analysisJson}}}

Here are the available resources: {{{resources}}}

Age Group: {{{ageGroup}}}

Return the drills in JSON format.`,
});

const generatePersonalizedDrillsFlow = ai.defineFlow(
  {
    name: 'generatePersonalizedDrillsFlow',
    inputSchema: GeneratePersonalizedDrillsInputSchema,
    outputSchema: GeneratePersonalizedDrillsOutputSchema,
  },
  async input => {
    const {output} = await generatePersonalizedDrillsPrompt(input);
    return output!;
  }
);

export {generatePersonalizedDrills};
