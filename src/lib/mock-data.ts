import type { Player, ShotAnalysis, Comment } from "@/lib/types";

export const mockPlayers: Player[] = [
  {
    id: "1",
    name: "Alex Johnson",
    avatarUrl: "https://placehold.co/100x100.png",
    "data-ai-hint": "male portrait",
    ageGroup: "U18",
    playerLevel: "Advanced",
  },
  {
    id: "2",
    name: "Maria Garcia",
    avatarUrl: "https://placehold.co/100x100.png",
    "data-ai-hint": "female portrait",
    ageGroup: "U15",
    playerLevel: "Intermediate",
  },
  {
    id: "3",
    name: "Sam Chen",
    avatarUrl: "https://placehold.co/100x100.png",
    "data-ai-hint": "male portrait",
    ageGroup: "U13",
    playerLevel: "Beginner",
  },
];

export const mockAnalyses: ShotAnalysis[] = [
  {
    id: "101",
    playerId: "1",
    createdAt: "2024-07-20T10:00:00Z",
    videoUrl: "https://placehold.co/1280x720.png",
    shotType: "Three-Pointer",
    analysisSummary:
      "Alex shows a strong, consistent release but needs to improve balance during the shot. The elbow alignment is slightly off, causing occasional misses to the right.",
    strengths: ["Quick release", "High arc", "Good follow-through"],
    weaknesses: ["Slight elbow flare", "Off-balance on landing", "Inconsistent foot placement"],
    recommendations: ["Focus on 'elbow-in' drills.", "Practice one-legged shots to improve balance.", "Use a line on the court to ensure consistent foot setup."],
    keyframes: [
      "https://placehold.co/640x360.png",
      "https://placehold.co/640x360.png",
      "https://placehold.co/640x360.png",
      "https://placehold.co/640x360.png",
    ],
  },
  {
    id: "102",
    playerId: "1",
    createdAt: "2024-07-22T11:00:00Z",
    videoUrl: "https://placehold.co/1280x720.png",
    shotType: "Free Throw",
    analysisSummary:
      "A much-improved free throw session. Balance is better, and elbow alignment is more consistent. The release point is now very reliable.",
    strengths: ["Excellent balance", "Consistent release point", "Strong mental focus"],
    weaknesses: ["Slightly slow setup routine", "Could generate more power from legs"],
    recommendations: ["Streamline pre-shot routine to be quicker.", "Incorporate box jumps to increase explosive power from the legs."],
    keyframes: [
      "https://placehold.co/640x360.png",
      "https://placehold.co/640x360.png",
      "https://placehold.co/640x360.png",
      "https://placehold.co/640x360.png",
    ],
  },
  {
    id: "201",
    playerId: "2",
    createdAt: "2024-07-21T09:30:00Z",
    videoUrl: "https://placehold.co/1280x720.png",
    shotType: "Mid-Range",
    analysisSummary:
      "Maria has a solid foundation but tends to release the ball a bit too early on her way up. This affects the shot's arc and power.",
    strengths: ["Good footwork", "Solid stance", "Eyes on the rim"],
    weaknesses: ["Releasing on the way up", "Needs more wrist snap", "Slight hesitation in motion"],
    recommendations: ["Practice 'shooting from a chair' to isolate the upper body and focus on the release point.", "Exaggerate the 'hand in the cookie jar' follow-through for better wrist action."],
    keyframes: [
      "https://placehold.co/640x360.png",
      "https://placehold.co/640x360.png",
      "https://placehold.co/640x360.png",
      "https://placehold.co/640x360.png",
    ],
  },
];

export const mockComments: Comment[] = [
    { id: '1', author: 'Coach David', text: 'Great progress on the elbow alignment, Alex. Keep it up!', createdAt: '2024-07-20T10:05:00Z' },
    { id: '2', author: 'Alex Johnson', text: 'Thanks coach! The drills are really helping.', createdAt: '2024-07-20T12:30:00Z' },
];
