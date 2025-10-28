import { NextResponse } from 'next/server';

export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    ffmpeg: {
      module: {},
      resolvedPath: '',
      binaryExists: false,
      executable: false
    },
    platform: process.platform,
    nodeVersion: process.version
  };

  try {
    // Intentar cargar ffmpeg-static
    const ffmpegStatic = require('ffmpeg-static');
    diagnostics.ffmpeg.module = {
      type: typeof ffmpegStatic,
      directValue: typeof ffmpegStatic === 'string' ? ffmpegStatic.substring(0, 100) : String(ffmpegStatic).substring(0, 100),
      hasPath: Boolean(ffmpegStatic?.path),
      path: ffmpegStatic?.path
    };

    const { accessSync, constants } = require('fs');
    const RESOLVED_FFMPEG = ffmpegStatic?.path || ffmpegStatic;
    
    diagnostics.ffmpeg.resolvedPath = RESOLVED_FFMPEG;

    // Verificar existencia
    try {
      accessSync(RESOLVED_FFMPEG, constants.F_OK);
      diagnostics.ffmpeg.binaryExists = true;

      // Verificar permisos de ejecución
      const { accessSync: access } = require('fs');
      try {
        accessSync(RESOLVED_FFMPEG, constants.X_OK);
        diagnostics.ffmpeg.executable = true;
      } catch {
        diagnostics.ffmpeg.executable = false;
      }
    } catch (err: any) {
      diagnostics.ffmpeg.binaryExists = false;
      diagnostics.ffmpeg.error = err.message;
    }

    // Intentar ejecutar FFmpeg
    const { spawn } = require('child_process');
    diagnostics.ffmpeg.testExecution = 'running';
    
    try {
      await new Promise((resolve, reject) => {
        const child = spawn(RESOLVED_FFMPEG, ['-version'], { timeout: 5000 });
        let output = '';
        child.stdout?.on('data', (d: any) => { output += String(d); });
        child.stderr?.on('data', (d: any) => { output += String(d); });
        child.on('error', (err: any) => {
          diagnostics.ffmpeg.executionError = err.message;
          reject(err);
        });
        child.on('close', (code: number) => {
          diagnostics.ffmpeg.versionOutput = output.substring(0, 500);
          diagnostics.ffmpeg.exitCode = code;
          resolve(code);
        });
      });
      diagnostics.ffmpeg.testExecution = 'success';
    } catch (execErr: any) {
      diagnostics.ffmpeg.testExecution = 'failed';
      diagnostics.ffmpeg.executionError = execErr.message;
    }

  } catch (err: any) {
    diagnostics.error = err.message;
    diagnostics.stack = err.stack;
  }

  return NextResponse.json(diagnostics, { status: 200 });
}

