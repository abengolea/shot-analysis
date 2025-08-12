import type { Player, ShotAnalysis, Comment, Coach } from "@/lib/types";

export const mockPlayers: Player[] = [
  {
    id: "1",
    name: "Alex Johnson",
    avatarUrl: "https://placehold.co/100x100.png",
    "data-ai-hint": "male portrait",
    ageGroup: "U18",
    playerLevel: "Avanzado",
  },
  {
    id: "2",
    name: "Maria Garcia",
    avatarUrl: "https://placehold.co/100x100.png",
    "data-ai-hint": "female portrait",
    ageGroup: "U15",
    playerLevel: "Intermedio",
  },
  {
    id: "3",
    name: "Sam Chen",
    avatarUrl: "https://placehold.co/100x100.png",
    "data-ai-hint": "male portrait",
    ageGroup: "U13",
    playerLevel: "Principiante",
  },
];

export const mockAnalyses: ShotAnalysis[] = [
  {
    id: "101",
    playerId: "1",
    createdAt: "2024-07-20T10:00:00Z",
    videoUrl: "https://placehold.co/1280x720.png",
    shotType: "Tiro de Tres",
    analysisSummary:
      "Alex muestra un lanzamiento fuerte y consistente, pero necesita mejorar el equilibrio durante el tiro. La alineación del codo está ligeramente desviada, causando fallos ocasionales a la derecha.",
    strengths: ["Lanzamiento rápido", "Arco alto", "Buena continuación"],
    weaknesses: ["Codo ligeramente abierto", "Desequilibrio al aterrizar", "Posición de pies inconsistente"],
    recommendations: ["Concéntrate en ejercicios de 'codo adentro'.", "Practica tiros a una pierna para mejorar el equilibrio.", "Usa una línea en la cancha para asegurar una posición de pies consistente."],
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
    shotType: "Tiro Libre",
    analysisSummary:
      "Una sesión de tiros libres muy mejorada. El equilibrio es mejor y la alineación del codo es más consistente. El punto de lanzamiento es ahora muy fiable.",
    strengths: ["Excelente equilibrio", "Punto de lanzamiento consistente", "Fuerte enfoque mental"],
    weaknesses: ["Rutina de preparación un poco lenta", "Podría generar más potencia desde las piernas"],
    recommendations: ["Agiliza la rutina previa al tiro para que sea más rápida.", "Incorpora saltos al cajón para aumentar la potencia explosiva de las piernas."],
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
    shotType: "Tiro de Media Distancia",
    analysisSummary:
      "María tiene una base sólida pero tiende a soltar el balón un poco pronto en su ascenso. Esto afecta el arco y la potencia del tiro.",
    strengths: ["Buen juego de pies", "Postura sólida", "Ojos en el aro"],
    weaknesses: ["Lanzamiento en el ascenso", "Necesita más muñequeo", "Ligera vacilación en el movimiento"],
    recommendations: ["Practica 'tiros desde una silla' para aislar la parte superior del cuerpo y centrarse en el punto de lanzamiento.", "Exagera la continuación de 'la mano en la lata de galletas' para una mejor acción de muñeca."],
    keyframes: [
      "https://placehold.co/640x360.png",
      "https://placehold.co/640x360.png",
      "https://placehold.co/640x360.png",
      "https://placehold.co/640x360.png",
    ],
  },
];

export const mockComments: Comment[] = [
    { id: '1', author: 'Entrenador David', text: 'Gran progreso en la alineación del codo, Alex. ¡Sigue así!', createdAt: '2024-07-20T10:05:00Z' },
    { id: '2', author: 'Alex Johnson', text: '¡Gracias entrenador! Los ejercicios están ayudando mucho.', createdAt: '2024-07-20T12:30:00Z' },
];

export const mockCoaches: Coach[] = [
  {
    id: "c1",
    name: "David Miller",
    avatarUrl: "https://placehold.co/128x128.png",
    "data-ai-hint": "male coach",
    specialties: ["Técnica de Tiro", "Desarrollo de Jugadores Jóvenes"],
    experience: "15 años de experiencia como entrenador, ex-jugador NCAA D1.",
    rate: 75,
    rating: 4.9,
    reviews: 82,
  },
  {
    id: "c2",
    name: "Sophia Rodriguez",
    avatarUrl: "https://placehold.co/128x128.png",
    "data-ai-hint": "female coach",
    specialties: ["Agilidad y Juego de Pies", "Acondicionamiento Físico"],
    experience: "Entrenadora certificada en rendimiento deportivo con 10 años de experiencia.",
    rate: 65,
    rating: 4.8,
    reviews: 64,
  },
  {
    id: "c3",
    name: "Kenji Tanaka",
    avatarUrl: "https://placehold.co/128x128.png",
    "data-ai-hint": "male coach",
    specialties: ["Estrategia Ofensiva", "Análisis de Video"],
    experience: "Entrenador asistente en la liga profesional japonesa por 8 años.",
    rate: 80,
    rating: 5.0,
    reviews: 45,
  },
   {
    id: "c4",
    name: "Isabella Rossi",
    avatarUrl: "https://placehold.co/128x128.png",
    "data-ai-hint": "female coach",
    specialties: ["Defensa Perimetral", "IQ de Baloncesto"],
    experience: "Ex-jugadora profesional en Europa, 12 años de carrera.",
    rate: 70,
    rating: 4.9,
    reviews: 71,
  },
]
