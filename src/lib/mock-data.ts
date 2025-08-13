import type { Player, ShotAnalysis, Comment, Coach } from "@/lib/types";

export const mockPlayers: Player[] = [
  {
    id: "1",
    name: "Alex Johnson",
    email: "alex.johnson@example.com",
    dob: new Date("2006-05-15"),
    country: "US",
    phone: "+1-555-0101",
    avatarUrl: "https://placehold.co/100x100.png",
    "data-ai-hint": "male portrait",
    ageGroup: "U18",
    playerLevel: "Avanzado",
    coachId: "c1",
    status: "active",
  },
  {
    id: "2",
    name: "Maria Garcia",
    email: "maria.garcia@example.com",
    dob: new Date("2009-08-22"),
    country: "ES",
    phone: "+34-655-0102",
    avatarUrl: "https://placehold.co/100x100.png",
    "data-ai-hint": "female portrait",
    ageGroup: "U15",
    playerLevel: "Intermedio",
    coachId: "c1",
    status: "active",
  },
  {
    id: "3",
    name: "Sam Chen",
    email: "sam.chen@example.com",
    dob: new Date("2011-02-10"),
    country: "AR",
    phone: "+54-911-0103",
    avatarUrl: "https://placehold.co/100x100.png",
    "data-ai-hint": "male portrait",
    ageGroup: "U13",
    playerLevel: "Principiante",
    coachId: "c2",
    status: "suspended",
  },
];

const detailedChecklistData = [
    {
        category: 'Fundamentos',
        items: [
            { id: 'dc1', name: 'Posición de pies', description: 'Deben estar alineados al aro, separados al ancho de hombros.', status: 'Mejorable', comment: 'Ajustar ligeramente el pie de tiro para que quede más adelante.' },
            { id: 'dc7', name: 'Balance Corporal', description: 'El peso debe estar centrado, sin inclinarse hacia adelante o atrás.', status: 'Correcto', comment: '' },
            { id: 'dc12', name: 'Posición de Hombros', description: 'Hombros cuadrados al aro, paralelos a la línea de tiro libre.', status: 'Correcto', comment: '' },
            { id: 'dc19', name: 'Uso de las Piernas', description: 'Flexión adecuada de rodillas para generar potencia.', status: 'Mejorable', comment: 'Poca flexion de rodillas, el tiro pierde potencia.' },
            { id: 'dc13', name: 'Tensión Muscular', description: 'Músculos relajados, evitar rigidez innecesaria.', status: 'Mejorable', comment: 'Se nota tension en el cuello y hombros.' },
            { id: 'dc16', name: 'Posición de la Cabeza', description: 'Cabeza erguida y quieta durante todo el movimiento.', status: 'Correcto', comment: '' },
        ]
    },
    {
        category: 'Mecánica del Balón',
        items: [
            { id: 'dc2', name: 'Agarre del balón', description: 'La mano de tiro debajo del balón, la de guía al costado.', status: 'Correcto', comment: '' },
            { id: 'dc3', name: 'Set Point', description: 'Posición del balón antes de iniciar el tiro, usualmente sobre el ojo de tiro.', status: 'Correcto', comment: 'Buen Set Point, alto y cómodo.' },
            { id: 'dc9', name: 'Elevación del Balón', description: 'El balón debe subir en línea recta hacia el aro.', status: 'Correcto', comment: '' },
            { id: 'dc4', name: 'Alineación Codo-Rodilla', description: 'El codo de tiro debe estar alineado verticalmente sobre la rodilla y pie de tiro.', status: 'Incorrecto', comment: 'El codo se abre hacia afuera. Principal punto a corregir.' },
            { id: 'dc20', name: 'Coordinación Bilateral', description: 'Sincronización perfecta entre mano de tiro y mano de guía.', status: 'Mejorable', comment: 'La mano de guia a veces interfiere en el tiro.' },
        ]
    },
    {
        category: 'Ejecución y Seguimiento',
        items: [
            { id: 'dc8', name: 'Velocidad de Ejecución', description: 'Ritmo constante, ni muy rápido ni muy lento.', status: 'Correcto', comment: '' },
            { id: 'dc5', name: 'Empuje y Extensión', description: 'Movimiento fluido y ascendente usando piernas y brazo simultáneamente.', status: 'Correcto', comment: 'Buena transferencia de energía.' },
            { id: 'dc6', name: 'Continuación (Follow-through)', description: 'La muñeca se quiebra y los dedos apuntan al aro después de soltar.', status: 'Mejorable', comment: 'A veces el follow-through no es completo, afectando la rotación.' },
            { id: 'dc10', name: 'Rotación del Balón', description: 'Backspin consistente que ayuda al rebote suave.', status: 'Mejorable', comment: 'Mejorar la rotacion para un toque mas suave.' },
            { id: 'dc11', name: 'Arco de Tiro', description: 'Trayectoria alta (45-50 grados) para mejor ángulo de entrada.', status: 'Correcto', comment: '' },
            { id: 'dc18', name: 'Recuperación Post-Tiro', description: 'Mantener la forma hasta que el balón toque el aro.', status: 'Correcto', comment: '' },
            { id: 'dc17', name: 'Consistencia en la Forma', description: 'Repetición exacta del mismo movimiento en cada tiro.', status: 'Mejorable', comment: 'La forma varia cuando el cansancio aparece.' },
        ]
    }
];

export const mockAnalyses: ShotAnalysis[] = [
  {
    id: "101",
    playerId: "1",
    createdAt: "2024-05-20T10:00:00Z",
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
    score: 82,
    detailedChecklist: detailedChecklistData,
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
    score: 91,
    detailedChecklist: detailedChecklistData.map(category => ({
        ...category,
        items: category.items.map(item => {
            if (item.name === 'Alineación Codo-Rodilla') return {...item, status: 'Correcto', comment: '¡Gran mejora aquí! El codo se mantuvo alineado.'};
            return item;
        })
    })),
  },
  {
    id: "201",
    playerId: "2",
    createdAt: "2024-07-21T09:30:00Z",
    videoUrl: "https://placehold.co/1280x720.png",
    shotType: "Tiro de Media Distancia (Jump Shot)",
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
    score: 75,
    detailedChecklist: detailedChecklistData.map(category => ({
        ...category,
        items: category.items.map(item => {
            if (item.name === 'Empuje y Extensión') return {...item, status: 'Incorrecto', comment: 'El balón se suelta durante el ascenso, no en el punto más alto del salto.'};
            if (item.name === 'Continuación (Follow-through)') return {...item, status: 'Mejorable', comment: 'Falta un follow-through completo.'};
            return item;
        })
    })),
  },
];

export const mockComments: Comment[] = [
    { id: '1', author: 'Entrenador David', text: 'Gran progreso en la alineación del codo, Alex. ¡Sigue así!', createdAt: '2024-07-20T10:05:00Z' },
    { id: '2', author: 'Alex Johnson', text: '¡Gracias entrenador! Los ejercicios están ayudando mucho.', createdAt: '2024-07-20T12:30:00Z' },
];

export const mockCoaches: Coach[] = [
  {
    id: "c1",
    name: "Daniel Beltramo",
    avatarUrl: "https://placehold.co/128x128.png",
    "data-ai-hint": "male coach",
    specialties: ["Técnica de Tiro", "Desarrollo de Jugadores Jóvenes"],
    experience: "15 años de experiencia como entrenador, ex-jugador NCAA D1.",
    ratePerAnalysis: 50,
    rating: 4.9,
    reviews: 82,
    playerIds: ["1", "2"],
  },
  {
    id: "c2",
    name: "Pablo Genga",
    avatarUrl: "https://placehold.co/128x128.png",
    "data-ai-hint": "male coach",
    specialties: ["Agilidad y Juego de Pies", "Acondicionamiento Físico"],
    experience: "Entrenador certificado en rendimiento deportivo con 10 años de experiencia.",
    ratePerAnalysis: 45,
    rating: 4.8,
    reviews: 64,
    playerIds: ["3"],
  },
  {
    id: "c3",
    name: "Adrian Bengolea",
    avatarUrl: "https://placehold.co/128x128.png",
    "data-ai-hint": "male coach",
    specialties: ["Estrategia Ofensiva", "Análisis de Video"],
    experience: "Entrenador asistente en la liga profesional por 8 años.",
    ratePerAnalysis: 60,
    rating: 5.0,
    reviews: 45,
    playerIds: [],
  },
   {
    id: "c4",
    name: "Isabella Rossi",
    avatarUrl: "https://placehold.co/128x128.png",
    "data-ai-hint": "female coach",
    specialties: ["Defensa Perimetral", "IQ de Baloncesto"],
    experience: "Ex-jugadora profesional en Europa, 12 años de carrera.",
    ratePerAnalysis: 55,
    rating: 4.9,
    reviews: 71,
    playerIds: [],
  },
]
