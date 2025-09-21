#!/usr/bin/env node

/**
 * Script para instalar y configurar OpenPose
 * Compatible con Windows, macOS y Linux
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PLATFORM = process.platform;
const IS_WINDOWS = PLATFORM === 'win32';
const IS_MACOS = PLATFORM === 'darwin';
const IS_LINUX = PLATFORM === 'linux';

console.log('🏀 Instalando OpenPose para análisis de baloncesto...');
console.log(`Sistema operativo: ${PLATFORM}`);

async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Ejecutando: ${command} ${args.join(' ')}`);
    
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: IS_WINDOWS,
      ...options
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Comando falló con código ${code}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

async function checkCommand(command) {
  return new Promise((resolve) => {
    exec(`which ${command}${IS_WINDOWS ? '.exe' : ''}`, (error) => {
      resolve(!error);
    });
  });
}

async function installDependencies() {
  console.log('\n📦 Instalando dependencias...');

  if (IS_WINDOWS) {
    // Verificar si Chocolatey está instalado
    const hasChoco = await checkCommand('choco');
    if (hasChoco) {
      console.log('Instalando dependencias con Chocolatey...');
      await runCommand('choco', ['install', 'cmake', 'git', 'visualstudio2022buildtools', '-y']);
    } else {
      console.log('❌ Chocolatey no está instalado. Por favor instala manualmente:');
      console.log('- CMake: https://cmake.org/download/');
      console.log('- Git: https://git-scm.com/download/win');
      console.log('- Visual Studio Build Tools 2022');
      console.log('\nLuego ejecuta este script nuevamente.');
      return false;
    }
  } else if (IS_MACOS) {
    // Verificar si Homebrew está instalado
    const hasBrew = await checkCommand('brew');
    if (hasBrew) {
      console.log('Instalando dependencias con Homebrew...');
      await runCommand('brew', ['install', 'cmake', 'git', 'opencv']);
    } else {
      console.log('❌ Homebrew no está instalado. Por favor instala manualmente:');
      console.log('- Homebrew: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
      console.log('- CMake: brew install cmake');
      console.log('- Git: brew install git');
      console.log('- OpenCV: brew install opencv');
      return false;
    }
  } else if (IS_LINUX) {
    console.log('Instalando dependencias con apt...');
    await runCommand('sudo', ['apt', 'update']);
    await runCommand('sudo', ['apt', 'install', '-y', 'cmake', 'git', 'libopencv-dev', 'build-essential']);
  }

  return true;
}

async function cloneOpenPose() {
  console.log('\n📥 Clonando OpenPose...');
  
  const openposeDir = path.join(__dirname, '..', 'openpose');
  
  if (fs.existsSync(openposeDir)) {
    console.log('OpenPose ya está clonado. Actualizando...');
    process.chdir(openposeDir);
    await runCommand('git', ['pull']);
  } else {
    await runCommand('git', ['clone', 'https://github.com/CMU-Perceptual-Computing-Lab/openpose.git', openposeDir]);
  }
}

async function buildOpenPose() {
  console.log('\n🔨 Compilando OpenPose...');
  
  const openposeDir = path.join(__dirname, '..', 'openpose');
  process.chdir(openposeDir);

  // Crear directorio de build
  const buildDir = path.join(openposeDir, 'build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
  }
  process.chdir(buildDir);

  // Configurar con CMake
  const cmakeArgs = [
    '-DCMAKE_BUILD_TYPE=Release',
    '-DBUILD_PYTHON=ON',
    '-DUSE_CUDNN=OFF', // Deshabilitar CUDNN por defecto
    '-DGPU_MODE=CPU_ONLY' // Usar solo CPU por defecto
  ];

  await runCommand('cmake', cmakeArgs);

  // Compilar
  const makeCommand = IS_WINDOWS ? 'cmake' : 'make';
  const makeArgs = IS_WINDOWS ? ['--build', '.', '--config', 'Release'] : ['-j4'];

  await runCommand(makeCommand, makeArgs);
}

async function setupPythonBindings() {
  console.log('\n🐍 Configurando bindings de Python...');
  
  const openposeDir = path.join(__dirname, '..', 'openpose');
  const pythonDir = path.join(openposeDir, 'build', 'python');
  
  if (fs.existsSync(pythonDir)) {
    process.chdir(pythonDir);
    await runCommand('pip', ['install', '-e', '.']);
  }
}

async function createTestScript() {
  console.log('\n📝 Creando script de prueba...');
  
  const testScript = `
#!/usr/bin/env python3

import sys
import os

# Agregar OpenPose al path
openpose_path = os.path.join(os.path.dirname(__file__), '..', 'openpose', 'build', 'python')
sys.path.append(openpose_path)

try:
    import openpose as op
    print("✅ OpenPose Python bindings funcionando correctamente!")
    print(f"Versión: {op.__version__ if hasattr(op, '__version__') else 'Desconocida'}")
except ImportError as e:
    print("❌ Error importando OpenPose:", e)
    print("Por favor verifica la instalación.")
`;

  const scriptPath = path.join(__dirname, '..', 'test-openpose.py');
  fs.writeFileSync(scriptPath, testScript);
  console.log(`Script de prueba creado: ${scriptPath}`);
}

async function main() {
  try {
    console.log('🚀 Iniciando instalación de OpenPose...');

    // Verificar dependencias
    const depsInstalled = await installDependencies();
    if (!depsInstalled) {
      console.log('\n❌ Instalación de dependencias falló. Por favor instala manualmente.');
      process.exit(1);
    }

    // Clonar OpenPose
    await cloneOpenPose();

    // Compilar OpenPose
    await buildOpenPose();

    // Configurar Python bindings
    await setupPythonBindings();

    // Crear script de prueba
    await createTestScript();

    console.log('\n✅ ¡OpenPose instalado exitosamente!');
    console.log('\n📋 Próximos pasos:');
    console.log('1. Ejecuta: python test-openpose.py');
    console.log('2. Si funciona, prueba con un video real');
    console.log('3. Ajusta la configuración según tu hardware');
    
    console.log('\n🔧 Configuración recomendada:');
    console.log('- Para CPU: GPU_MODE=CPU_ONLY');
    console.log('- Para GPU NVIDIA: GPU_MODE=CUDA (requiere CUDA toolkit)');
    console.log('- Para mejor rendimiento: USE_CUDNN=ON (requiere cuDNN)');

  } catch (error) {
    console.error('\n❌ Error durante la instalación:', error.message);
    console.log('\n🔧 Soluciones comunes:');
    console.log('1. Verifica que todas las dependencias estén instaladas');
    console.log('2. Asegúrate de tener suficiente espacio en disco (al menos 10GB)');
    console.log('3. En Windows, ejecuta como administrador');
    console.log('4. En Linux, verifica que tengas los headers de desarrollo');
    
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
