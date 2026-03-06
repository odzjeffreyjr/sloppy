import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export function createLogger(logDir: string): Logger {
  fs.mkdirSync(logDir, { recursive: true });

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .slice(0, 19);
  const logFile = path.join(logDir, `population-${timestamp}.log`);
  const stream = fs.createWriteStream(logFile, { flags: 'a' });

  function write(level: string, message: string): void {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${message}`;
    stream.write(line + '\n');
    // Mirror to console so the user sees progress during long runs
    if (level === 'ERROR') {
      console.error(line);
    } else if (level === 'WARN') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  return {
    info: (msg) => write('INFO', msg),
    warn: (msg) => write('WARN', msg),
    error: (msg) => write('ERROR', msg),
  };
}
