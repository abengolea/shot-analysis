// Script para agregar el entrenador Esteban Daniel Velasco
// Ejecutar con: node add-coach-esteban-velasco.js
// Requiere: tener la foto en la carpeta actual con el nombre "esteban-velasco.jpg" (o .png)

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 'shotanalisys',
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.projectId,
    storageBucket: process.env.FIREBASE_ADMIN_STORAGE_BUCKET || 'shotanalisys.firebasestorage.app',
  });
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

async function addCoachEstebanVelasco() {
  try {
    console.log('🚀 Iniciando proceso de alta del entrenador Esteban Daniel Velasco...\n');

    // Datos del entrenador
    const coachData = {
      name: 'Esteban Daniel Velasco',
      email: 'profevelasco80@gmail.com',
      age: 45,
      location: 'Tucumán, Argentina',
      
      // Curriculum estructurado
      bio: `Profesor universitario de Educación Física con especialización en básquet. Entrenador ENEBA nivel 3 dedicado al mini básquet e iniciación deportiva en niños. Especialista en la enseñanza del lanzamiento. Autor del libro "Reflexiones sobre Mini básquet" y participante en un capítulo del manual de tiro de la CAB. Tutor de los cursos de la Escuela Nacional de Entrenadores durante 3 años. Experiencia en distintos campus de básquet y talleres en todo el país. Integrante del staff de los campus de mini de Rubén Magnano. Disertaciones virtuales y presenciales en cursos, reválidas ENEBA y charlas relacionadas al básquet inicial para todo el país y el exterior.`,
      
      experience: `Profesor universitario de Educación Física. Entrenador de Básquet ENEBA nivel 3. Docente de escuelas secundarias. Dedicado al mini básquet e iniciación deportiva en niños. Especialista en la enseñanza del lanzamiento.`,
      
      education: 'Profesor universitario de Educación Física',
      
      certifications: [
        'Entrenador de Básquet ENEBA nivel 3',
        'Autor del libro "Reflexiones sobre Mini básquet"',
        'Participación en capítulo del manual de tiro de la CAB',
        'Tutor de cursos de la Escuela Nacional de Entrenadores (3 años)'
      ],
      
      specialties: [
        'Mini básquet',
        'Iniciación deportiva en niños',
        'Enseñanza del lanzamiento',
        'Técnica de tiro'
      ],
      
      yearsOfExperience: 25, // Estimado basado en su trayectoria
      ratePerAnalysis: 25000,
      showRate: true,
      
      // Campos adicionales
      role: 'coach',
      status: 'active',
      verified: true,
      publicVisible: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Verificar si el email ya existe
    let userId;
    try {
      const existingUser = await auth.getUserByEmail(coachData.email);
      userId = existingUser.uid;
      console.log(`⚠️  Usuario ya existe con email ${coachData.email}`);
      console.log(`   ID: ${userId}`);
      console.log(`   Continuando con actualización del perfil...\n`);
    } catch (error) {
      // Usuario no existe, crear nuevo
      console.log(`📧 Creando nuevo usuario en Firebase Auth...`);
      const newUser = await auth.createUser({
        email: coachData.email,
        displayName: coachData.name,
        emailVerified: true, // Verificado automáticamente
      });
      userId = newUser.uid;
      console.log(`✅ Usuario creado: ${userId}\n`);
    }

    // Subir foto al Storage
    let photoUrl = null;
    const photoExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    let photoPath = null;
    
    for (const ext of photoExtensions) {
      const possiblePath = path.join(__dirname, `esteban-velasco${ext}`);
      if (fs.existsSync(possiblePath)) {
        photoPath = possiblePath;
        break;
      }
    }

    if (photoPath) {
      console.log(`📸 Subiendo foto desde: ${photoPath}`);
      const bucket = storage.bucket();
      const fileName = `profile-images/coaches/${userId}/${Date.now()}-esteban-velasco${path.extname(photoPath)}`;
      const file = bucket.file(fileName);
      
      const fileBuffer = fs.readFileSync(photoPath);
      await file.save(fileBuffer, {
        metadata: {
          contentType: photoPath.endsWith('.png') ? 'image/png' : 
                      photoPath.endsWith('.webp') ? 'image/webp' : 
                      'image/jpeg',
        },
      });
      
      await file.makePublic();
      photoUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      console.log(`✅ Foto subida: ${photoUrl}\n`);
    } else {
      console.log(`⚠️  No se encontró la foto. Buscando archivos:`);
      photoExtensions.forEach(ext => {
        const testPath = path.join(__dirname, `esteban-velasco${ext}`);
        console.log(`   - ${testPath} ${fs.existsSync(testPath) ? '✓' : '✗'}`);
      });
      console.log(`   Continuando sin foto. Puedes subirla después desde el panel de administración.\n`);
    }

    // Crear/actualizar documento del coach en Firestore
    const coachRef = db.collection('coaches').doc(userId);
    const coachDoc = await coachRef.get();
    
    const finalCoachData = {
      ...coachData,
      userId,
      photoUrl: photoUrl || coachDoc.data()?.photoUrl || null,
      avatarUrl: photoUrl || coachDoc.data()?.avatarUrl || 'https://placehold.co/200x200.png',
    };

    if (coachDoc.exists) {
      console.log(`📝 Actualizando perfil existente del entrenador...`);
      await coachRef.set(finalCoachData, { merge: true });
      console.log(`✅ Perfil actualizado exitosamente\n`);
    } else {
      console.log(`📝 Creando nuevo perfil del entrenador...`);
      await coachRef.set(finalCoachData);
      console.log(`✅ Perfil creado exitosamente\n`);
    }

    // Mostrar resumen
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ENTRENADOR AGREGADO EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Nombre: ${coachData.name}`);
    console.log(`Email: ${coachData.email}`);
    console.log(`ID: ${userId}`);
    console.log(`Edad: ${coachData.age} años`);
    console.log(`Ubicación: ${coachData.location}`);
    console.log(`Años de experiencia: ${coachData.yearsOfExperience}`);
    console.log(`Estado: ${coachData.status}`);
    console.log(`Verificado: ${coachData.verified ? 'Sí' : 'No'}`);
    console.log(`Visible públicamente: ${coachData.publicVisible ? 'Sí' : 'No'}`);
    if (photoUrl) {
      console.log(`Foto: ${photoUrl}`);
    } else {
      console.log(`Foto: No subida (puedes agregarla desde el panel de admin)`);
    }
    console.log(`\nCertificaciones: ${coachData.certifications.length}`);
    coachData.certifications.forEach((cert, i) => {
      console.log(`  ${i + 1}. ${cert}`);
    });
    console.log(`\nEspecialidades: ${coachData.specialties.length}`);
    coachData.specialties.forEach((spec, i) => {
      console.log(`  ${i + 1}. ${spec}`);
    });
    console.log('═══════════════════════════════════════════════════════════\n');

    // Generar link de reset de contraseña
    try {
      const resetLink = await auth.generatePasswordResetLink(coachData.email);
      console.log('🔗 Link para establecer contraseña:');
      console.log(`   ${resetLink}\n`);
      console.log('💡 Envía este link al entrenador para que pueda crear su contraseña.');
    } catch (error) {
      console.log('⚠️  No se pudo generar el link de reset de contraseña:', error.message);
    }

  } catch (error) {
    console.error('❌ Error agregando entrenador:', error);
    if (error.code) {
      console.error(`   Código: ${error.code}`);
    }
    if (error.message) {
      console.error(`   Mensaje: ${error.message}`);
    }
  } finally {
    process.exit(0);
  }
}

// Ejecutar
addCoachEstebanVelasco();

