import winston from 'winston';

const { combine, timestamp, printf, colorize, align } = winston.format;

/**
 * Custom log format with colors and alignment
 */
const logFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaString = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
  return `[${timestamp}] ${level}: ${message}${metaString}`;
});

/**
 * Create a logger instance with console transport
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    colorize({ all: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    align(),
    logFormat
  ),
  transports: [new winston.transports.Console()],
});

/**
 * Extended logger with context support
 */
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    logger.debug(`[${this.context}] ${message}`, meta || {});
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    logger.info(`[${this.context}] ${message}`, meta || {});
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    logger.warn(`[${this.context}] ${message}`, meta || {});
  }

  public error(message: string, meta?: Record<string, unknown> | Error): void {
    if (meta instanceof Error) {
      logger.error(`[${this.context}] ${message}`, { error: meta.message, stack: meta.stack });
    } else {
      logger.error(`[${this.context}] ${message}`, meta || {});
    }
  }
}

/**
 * Create a logger with the given context
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}

export default logger;
