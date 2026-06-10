import {LoggerService, LogLevel} from '@nestjs/common';

type Fields = Record<string, unknown>;

/**
 * Minimal structured-JSON LoggerService. Every log is one JSON line — stdout
 * for info/warn/debug/verbose, stderr for error/fatal — so the API and the
 * worker share a single machine-parseable format that is greppable in
 * `docker logs` and ingestible by a log shipper.
 *
 * Wire it via `app.useLogger(new JsonLogger())` (HTTP) and
 * `ctx.useLogger(new JsonLogger())` (worker context). Components keep using the
 * standard Nest `Logger`; their output is routed through this formatter. A
 * string message is emitted as `msg`; an object message has its `msg`/`message`
 * field used as the text and its remaining keys spread as structured fields.
 *
 * See docs/adr/0003-structured-json-logging.md.
 */
export class JsonLogger implements LoggerService {
  private levels: LogLevel[] = [
    'log',
    'error',
    'warn',
    'debug',
    'verbose',
    'fatal',
  ];

  log(message: unknown, ...params: unknown[]): void {
    this.emit('log', 'info', message, params);
  }

  error(message: unknown, ...params: unknown[]): void {
    this.emit('error', 'error', message, params);
  }

  warn(message: unknown, ...params: unknown[]): void {
    this.emit('warn', 'warn', message, params);
  }

  debug(message: unknown, ...params: unknown[]): void {
    this.emit('debug', 'debug', message, params);
  }

  verbose(message: unknown, ...params: unknown[]): void {
    this.emit('verbose', 'verbose', message, params);
  }

  fatal(message: unknown, ...params: unknown[]): void {
    this.emit('fatal', 'fatal', message, params);
  }

  setLogLevels(levels: LogLevel[]): void {
    this.levels = levels;
  }

  private emit(
    nestLevel: LogLevel,
    outLevel: string,
    message: unknown,
    params: unknown[],
  ): void {
    if (!this.levels.includes(nestLevel)) return;

    // Nest appends the logger context as the final string param; anything left
    // over (e.g. an error stack on `error`) becomes `trace`.
    const extras = [...params];
    let context: string | undefined;
    if (extras.length && typeof extras[extras.length - 1] === 'string') {
      context = extras.pop() as string;
    }

    let msg: string;
    let fields: Fields = {};
    if (message !== null && typeof message === 'object') {
      const obj = {...(message as Fields)};
      msg = String(obj.msg ?? obj.message ?? '');
      delete obj.msg;
      delete obj.message;
      fields = obj;
    } else {
      msg = String(message);
    }

    const trace = extras.length ? extras.map(String).join(' ') : undefined;

    const record: Fields = {
      level: outLevel,
      time: new Date().toISOString(),
      ...(context ? {context} : {}),
      msg,
      ...fields,
      ...(trace ? {trace} : {}),
    };

    const line = JSON.stringify(record) + '\n';
    if (outLevel === 'error' || outLevel === 'fatal') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }
  }
}
