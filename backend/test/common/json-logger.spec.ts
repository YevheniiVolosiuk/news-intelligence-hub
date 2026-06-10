import {JsonLogger} from '../../src/common/logging/json-logger';

/** Capture the JSON line written for a single logger call. */
function captureLine(
  write: 'stdout' | 'stderr',
  fn: () => void,
): Record<string, unknown> {
  const lines: string[] = [];
  const spy = jest
    .spyOn(process[write], 'write')
    .mockImplementation((chunk: unknown) => {
      lines.push(String(chunk));
      return true;
    });
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
  expect(lines).toHaveLength(1);
  return JSON.parse(lines[0]);
}

describe('JsonLogger', () => {
  it('emits a string message as a JSON line with level, time, context, and msg', () => {
    const logger = new JsonLogger();
    const record = captureLine('stdout', () =>
      logger.log('pull-feed outcome=ok feedId=42', 'IngestionService'),
    );

    expect(record.level).toBe('info');
    expect(record.context).toBe('IngestionService');
    expect(record.msg).toBe('pull-feed outcome=ok feedId=42');
    expect(typeof record.time).toBe('string');
  });

  it('spreads an object message into structured fields', () => {
    const logger = new JsonLogger();
    const record = captureLine('stdout', () =>
      logger.log({msg: 'job.completed', feedId: 'f1', inserted: 3}, 'Worker'),
    );

    expect(record.msg).toBe('job.completed');
    expect(record.context).toBe('Worker');
    expect(record.feedId).toBe('f1');
    expect(record.inserted).toBe(3);
  });

  it('routes error to stderr at error level', () => {
    const logger = new JsonLogger();
    const record = captureLine('stderr', () =>
      logger.error({msg: 'job.failed', error: 'boom'}, 'Worker'),
    );

    expect(record.level).toBe('error');
    expect(record.msg).toBe('job.failed');
    expect(record.error).toBe('boom');
  });

  it('honours setLogLevels by suppressing disabled levels', () => {
    const logger = new JsonLogger();
    logger.setLogLevels(['error']);

    const spy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    logger.debug('quiet', 'Ctx');
    logger.log('also quiet', 'Ctx');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
