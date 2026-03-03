const { spawn } = require('child_process');
const path = require('path');

const requirementsPath = path.join(__dirname, '..', 'ml', 'requirements-pose.txt');
const pythonCandidates = ['python', 'python3'];

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function canRun(cmd, args) {
  try {
    await run(cmd, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function resolvePython() {
  for (const candidate of pythonCandidates) {
    if (await canRun(candidate, ['--version'])) {
      return candidate;
    }
  }
  return null;
}

(async () => {
  const python = await resolvePython();
  if (!python) {
    console.error('❌ Python no está disponible en este entorno.');
    process.exit(1);
  }

  console.log(`✅ Usando ${python}. Instalando deps de pose...`);
  await run(python, ['-m', 'pip', 'install', '-r', requirementsPath]);
  console.log('✅ Dependencias de pose instaladas.');
})().catch((err) => {
  console.error('❌ Error instalando deps de pose:', err.message || err);
  process.exit(1);
});
