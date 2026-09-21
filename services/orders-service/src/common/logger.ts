import { LoggerService, LogLevel } from '@nestjs/common';

/**
 * Minimal structured (JSON-lines) logger. Avoids pulling in nestjs-pino
 * across four services for a demo repo — one line per log entry, easy to
 * grep or feed into any log aggregator, no extra dependency surface.
 */
export class JsonLogger implements LoggerService {
  constructor(private readonly service: string) {}

  private write(level: LogLevel, message: unknown, context?: string) {
    const entry = {
      level,
      service: this.service,
      context,
      message,
      time: new Date().toISOString(),
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
  }

  log(message: unknown, context?: string) {
    this.write('log', message, context);
  }
  error(message: unknown, trace?: string, context?: string) {
    this.write('error', trace ? `${message} :: ${trace}` : message, context);
  }
  warn(message: unknown, context?: string) {
    this.write('warn', message, context);
  }
  debug(message: unknown, context?: string) {
    this.write('debug', message, context);
  }
  verbose(message: unknown, context?: string) {
    this.write('verbose', message, context);
  }
}
