import pino, { type LevelWithSilent, type Logger } from 'pino';

export function createLogger(level: LevelWithSilent): Logger {
  return pino({ level });
}
