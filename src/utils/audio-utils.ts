/**
 * Audio utility helpers
 */

import { spawn } from 'child_process';

/**
 * Get the duration of an audio file in seconds using ffprobe.
 * Returns null if ffprobe is unavailable or duration cannot be determined.
 */
export async function getAudioDuration(audioPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      audioPath
    ];

    const ffprobe = spawn('ffprobe', args);

    let output = '';
    ffprobe.stdout.on('data', chunk => {
      output += chunk.toString();
    });

    ffprobe.once('error', () => resolve(null));

    ffprobe.once('close', code => {
      if (code === 0) {
        const value = parseFloat(output.trim());
        if (!Number.isNaN(value) && Number.isFinite(value) && value > 0) {
          resolve(value);
          return;
        }
      }
      resolve(null);
    });
  });
}
