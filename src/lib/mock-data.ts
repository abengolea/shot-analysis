import type { Player, ShotAnalysis, Comment, Coach, ConnectionRequest, PlayerEvaluation, PlayerComment } from "@/lib/types";

// Datos de prueba vacíos - se reemplazarán con datos reales de Firebase
export const mockPlayers: Player[] = [
  {
    id: "player1",
    name: "Carlos Rodríguez",
    email: "carlos.rodriguez@email.com",
    role: "player",
    avatarUrl: "https://placehold.co/200x200/4F46E5/FFFFFF?text=CR",
    status: "active",
    createdAt: new Date("2023-06-15"),
    updatedAt: new Date("2024-01-15"),
    dob: new Date("2005-03-20"),
    country: "España",
    phone: "+34 612 345 678",
    ageGroup: "U18",
    playerLevel: "Intermedio",
    position: "Escolta",
    height: 185,
    weight: 78,
    dominantHand: "Derecha"
  },
  {
    id: "player2",
    name: "Ana Martínez",
    email: "ana.martinez@email.com",
    role: "player",
    avatarUrl: "https://placehold.co/200x200/DC2626/FFFFFF?text=AM",
    status: "active",
    createdAt: new Date("2023-08-10"),
    updatedAt: new Date("2024-01-15"),
    dob: new Date("2006-07-12"),
    country: "México",
    phone: "+52 55 1234 5678",
    ageGroup: "U18",
    playerLevel: "Principiante",
    position: "Base",
    height: 168,
    weight: 62,
    dominantHand: "Derecha"
  }
];

export const mockAnalyses: ShotAnalysis[] = [
  {
    id: "analysis1",
    playerId: "player1",
    createdAt: "2024-01-15T10:30:00",
    videoUrl: "https://example.com/video1.mp4",
    shotType: "Lanzamiento de Media Distancia (Jump Shot)",
    analysisSummary: "Excelente técnica de salto con buena elevación y seguimiento del brazo.",
    strengths: ["Elevación consistente", "Seguimiento del brazo", "Balance corporal"],
    weaknesses: ["Posición de los pies", "Timing del salto"],
    recommendations: ["Trabajar en la posición de los pies", "Mejorar el timing del salto"],
    keyframes: {
      front: ["https://placehold.co/300x200/4F46E5/FFFFFF?text=Front+1"],
      back: ["https://placehold.co/300x200/4F46E5/FFFFFF?text=Back+1"],
      left: ["https://placehold.co/300x200/4F46E5/FFFFFF?text=Left+1"],
      right: ["https://placehold.co/300x200/4F46E5/FFFFFF?text=Right+1"]
    },
    score: 8.5
  },
  {
    id: "analysis2",
    playerId: "player1",
    createdAt: "2024-01-10T14:20:00",
    videoUrl: "https://example.com/video2.mp4",
    shotType: "Lanzamiento de Tres",
    analysisSummary: "Buena potencia en el tiro pero necesita mejorar la precisión.",
    strengths: ["Potencia del tiro", "Confianza en el lanzamiento"],
    weaknesses: ["Precisión", "Posición de los pies"],
    recommendations: ["Enfocarse en la precisión", "Trabajar en la posición de los pies"],
    keyframes: {
      front: ["https://placehold.co/300x200/4F46E5/FFFFFF?text=Front+2"],
      back: ["https://placehold.co/300x200/4F46E5/FFFFFF?text=Back+2"],
      left: ["https://placehold.co/300x200/4F46E5/FFFFFF?text=Left+2"],
      right: ["https://placehold.co/300x200/4F46E5/FFFFFF?text=Right+2"]
    },
    score: 7.2
  }
];

export const mockCoaches: Coach[] = [
  {
    id: "coach1",
    name: "Carlos Mendoza",
    email: "carlos.mendoza@coach.com",
    role: "coach",
    avatarUrl: "https://placehold.co/200x200/4F46E5/FFFFFF?text=CM",
    status: "active",
    createdAt: new Date("2023-01-15"),
    updatedAt: new Date("2024-01-15"),
    experience: "Entrenador de baloncesto con 15+ años de experiencia",
    ratePerAnalysis: 45,
    rating: 4.8,
    reviews: 127,
    playerIds: ["player1", "player2", "player3"],
    certifications: ["FIBA Level 2", "NCAA Certified", "Sports Science Degree"],
    specialties: ["Técnica de Tiro", "Defensa", "Condición Física"],
    yearsOfExperience: 15,
    education: "Licenciatura en Ciencias del Deporte",
    bio: "Especialista en mejorar la técnica de tiro de jugadores de todos los niveles. He trabajado con equipos universitarios y jugadores profesionales.",
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false
    }
  },
  {
    id: "coach2",
    name: "Ana Rodríguez",
    email: "ana.rodriguez@coach.com",
    role: "coach",
    avatarUrl: "https://placehold.co/200x200/DC2626/FFFFFF?text=AR",
    status: "active",
    createdAt: new Date("2023-03-20"),
    updatedAt: new Date("2024-01-15"),
    experience: "Entrenadora especializada en desarrollo juvenil",
    ratePerAnalysis: 35,
    rating: 4.9,
    reviews: 89,
    playerIds: ["player4", "player5"],
    certifications: ["FIBA Level 1", "Youth Development Specialist"],
    specialties: ["Desarrollo Juvenil", "Fundamentos", "Trabajo en Equipo"],
    yearsOfExperience: 8,
    education: "Maestría en Psicología del Deporte",
    bio: "Me enfoco en desarrollar jugadores jóvenes, construyendo una base sólida de fundamentos y confianza mental.",
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: false,
      saturday: true,
      sunday: false
    }
  },
  {
    id: "coach3",
    name: "Miguel Torres",
    email: "miguel.torres@coach.com",
    role: "coach",
    avatarUrl: "https://placehold.co/200x200/059669/FFFFFF?text=MT",
    status: "active",
    createdAt: new Date("2023-06-10"),
    updatedAt: new Date("2024-01-15"),
    experience: "Ex jugador profesional convertido en entrenador",
    ratePerAnalysis: 55,
    rating: 4.7,
    reviews: 156,
    playerIds: ["player6", "player7", "player8"],
    certifications: ["FIBA Level 3", "Former Pro Player"],
    specialties: ["Tiro de Alta Precisión", "Estrategia", "Mentalidad Competitiva"],
    yearsOfExperience: 12,
    education: "Carrera Profesional en Baloncesto",
    bio: "Como ex jugador profesional, entiendo las demandas del juego de alto nivel. Me especializo en mejorar la precisión y mentalidad competitiva.",
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true
    }
  },
  {
    id: "coach4",
    name: "Laura Fernández",
    email: "laura.fernandez@coach.com",
    role: "coach",
    avatarUrl: "https://placehold.co/200x200/7C3AED/FFFFFF?text=LF",
    status: "active",
    createdAt: new Date("2023-09-05"),
    updatedAt: new Date("2024-01-15"),
    experience: "Entrenadora de condición física y técnica",
    ratePerAnalysis: 40,
    rating: 4.6,
    reviews: 73,
    playerIds: ["player9", "player10"],
    certifications: ["Strength & Conditioning", "FIBA Level 1", "Nutrition Specialist"],
    specialties: ["Condición Física", "Nutrición", "Prevención de Lesiones"],
    yearsOfExperience: 6,
    education: "Licenciatura en Fisioterapia",
    bio: "Combinando fisioterapia y entrenamiento deportivo, ayudo a los jugadores a mejorar su rendimiento y prevenir lesiones.",
    availability: {
      monday: true,
      tuesday: true,
      wednesday: false,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false
    }
  },
  {
    id: "coach5",
    name: "Roberto Silva",
    email: "roberto.silva@coach.com",
    role: "coach",
    avatarUrl: "https://placehold.co/200x200/EA580C/FFFFFF?text=RS",
    status: "active",
    createdAt: new Date("2023-11-12"),
    updatedAt: new Date("2024-01-15"),
    experience: "Entrenador de equipos universitarios",
    ratePerAnalysis: 50,
    rating: 4.5,
    reviews: 42,
    playerIds: ["player11", "player12"],
    certifications: ["NCAA Division I Coach", "FIBA Level 2"],
    specialties: ["Estrategia de Equipo", "Análisis de Video", "Desarrollo de Líderes"],
    yearsOfExperience: 20,
    education: "Maestría en Administración Deportiva",
    bio: "Con 20 años entrenando equipos universitarios, me especializo en desarrollar estrategias de equipo y líderes dentro de la cancha.",
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false
    }
  }
];

export const mockComments: Comment[] = [];

// Datos mock para evaluaciones de jugadores
export const mockPlayerEvaluations: PlayerEvaluation[] = [
  {
    id: "eval1",
    playerId: "player1",
    coachId: "coach1",
    coachName: "Carlos Mendoza",
    coachAvatarUrl: "https://placehold.co/100x100/4F46E5/FFFFFF?text=CM",
    evaluationDate: new Date("2024-01-15"),
    overallScore: 8.2,
    technicalScore: 8.5,
    physicalScore: 7.8,
    mentalScore: 8.0,
    strengths: [
      "Excelente técnica de tiro",
      "Buena comprensión del juego",
      "Trabajo duro y dedicación",
      "Liderazgo en la cancha"
    ],
    weaknesses: [
      "Necesita mejorar la defensa",
      "Velocidad de reacción",
      "Resistencia física"
    ],
    recommendations: [
      "Enfocarse en ejercicios de defensa",
      "Trabajar en agilidad y velocidad",
      "Mejorar la condición física"
    ],
    notes: "Carlos muestra un gran potencial y dedicación. Su técnica de tiro es excepcional para su edad. Con trabajo en defensa y condición física, puede convertirse en un jugador completo.",
    nextSteps: [
      "Programa de defensa 3x por semana",
      "Entrenamiento de agilidad 2x por semana",
      "Evaluación de seguimiento en 4 semanas"
    ]
  }
];

// Datos mock para comentarios de entrenadores sobre jugadores
export const mockPlayerComments: PlayerComment[] = [
  {
    id: "comment1",
    playerId: "player1",
    coachId: "coach1",
    coachName: "Carlos Mendoza",
    coachAvatarUrl: "https://placehold.co/100x100/4F46E5/FFFFFF?text=CM",
    comment: "Excelente progreso en la técnica de tiro. Carlos ha mejorado significativamente su precisión en los últimos 2 meses. Recomiendo continuar con los ejercicios de seguimiento del brazo.",
    createdAt: new Date("2024-01-18T14:30:00"),
    isPublic: true
  },
  {
    id: "comment2",
    playerId: "player1",
    coachId: "coach1",
    coachName: "Carlos Mendoza",
    coachAvatarUrl: "https://placehold.co/100x100/4F46E5/FFFFFF?text=CM",
    comment: "Necesita trabajar más en la defensa lateral. Su posición de los pies en defensa no es consistente. Programar sesiones específicas de defensa.",
    createdAt: new Date("2024-01-16T10:15:00"),
    isPublic: false
  },
  {
    id: "comment3",
    playerId: "player1",
    coachId: "coach2",
    coachName: "Ana Rodríguez",
    coachAvatarUrl: "https://placehold.co/100x100/DC2626/FFFFFF?text=AR",
    comment: "He observado a Carlos en varios partidos y su desarrollo técnico es impresionante. Su trabajo en equipo y comunicación en la cancha son excelentes.",
    createdAt: new Date("2024-01-14T16:45:00"),
    isPublic: true
  }
];

// Datos mock para solicitudes de conexión
export const mockConnectionRequests: ConnectionRequest[] = [
  {
    id: "1",
    playerId: "player1",
    playerName: "Carlos Rodríguez",
    playerEmail: "carlos.rodriguez@email.com",
    playerAvatarUrl: "https://placehold.co/100x100.png",
    coachId: "coach1",
    message: "Hola! He visto tu perfil y me gustaría que me ayudes a mejorar mi técnica de lanzamiento. Soy jugador amateur y quiero llevar mi juego al siguiente nivel.",
    status: "pending",
    createdAt: new Date("2024-01-15T10:30:00"),
    updatedAt: new Date("2024-01-15T10:30:00"),
    playerLevel: "Intermedio",
    position: "Escolta",
    ageGroup: "Amateur",
    country: "España"
  },
  {
    id: "2",
    playerId: "player2",
    playerName: "Ana Martínez",
    playerEmail: "ana.martinez@email.com",
    playerAvatarUrl: "https://placehold.co/100x100.png",
    coachId: "coach1",
    message: "Soy jugadora de baloncesto juvenil y necesito ayuda con mi técnica. He escuchado excelentes comentarios sobre tu trabajo como entrenador.",
    status: "accepted",
    createdAt: new Date("2024-01-10T14:20:00"),
    updatedAt: new Date("2024-01-12T09:15:00"),
    playerLevel: "Principiante",
    position: "Base",
    ageGroup: "U18",
    country: "México"
  },
  {
    id: "3",
    playerId: "player3",
    playerName: "Luis González",
    playerEmail: "luis.gonzalez@email.com",
    playerAvatarUrl: "https://placehold.co/100x100.png",
    coachId: "coach1",
    message: "Entrenador, soy jugador semi-profesional y quiero mejorar mi precisión en tiros de tres puntos. ¿Podrías ayudarme?",
    status: "pending",
    createdAt: new Date("2024-01-18T16:45:00"),
    updatedAt: new Date("2024-01-18T16:45:00"),
    playerLevel: "Avanzado",
    position: "Alero",
    ageGroup: "SemiPro",
    country: "Argentina"
  },
  {
    id: "4",
    playerId: "player4",
    playerName: "María Silva",
    playerEmail: "maria.silva@email.com",
    playerAvatarUrl: "https://placehold.co/100x100.png",
    coachId: "coach1",
    message: "Hola! Soy jugadora amateur y quiero mejorar mi técnica. ¿Tienes experiencia trabajando con principiantes?",
    status: "rejected",
    createdAt: new Date("2024-01-05T11:00:00"),
    updatedAt: new Date("2024-01-07T15:30:00"),
    playerLevel: "Principiante",
    position: "Pívot",
    ageGroup: "Amateur",
    country: "Colombia"
  }
];

