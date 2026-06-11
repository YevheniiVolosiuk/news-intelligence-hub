import {readFileSync} from 'fs';
import {resolve} from 'path';
import {parse} from 'yaml';
import {
  resolveLabelConcurrency,
  resolvePullConcurrency,
} from '../../src/worker-runtime';

const repoRoot = resolve(__dirname, '../../..');

interface ComposeService {
  command?: string[];
  deploy?: {replicas?: number};
}

function composeServices(file: string): Record<string, ComposeService> {
  const parsed = parse(readFileSync(resolve(repoRoot, file), 'utf8')) as {
    services: Record<string, ComposeService>;
  };
  return parsed.services;
}

/**
 * ADR-0004 guard. The worker is split into two entrypoints so the LLM
 * concurrency cap is exact: `worker-label` runs at `LLM_CONCURRENCY` and is
 * pinned to a single replica, while `worker-pull` scales freely. These tests
 * lock the invariant in code and the topology in the compose files.
 */
describe('worker topology (ADR-0004)', () => {
  describe('resolveLabelConcurrency', () => {
    it('uses LLM_CONCURRENCY so the label worker honours the global cap', () => {
      expect(resolveLabelConcurrency({LLM_CONCURRENCY: '3'})).toBe(3);
    });

    it('falls back to the documented default when unset', () => {
      expect(resolveLabelConcurrency({})).toBe(2);
    });
  });

  describe('resolvePullConcurrency', () => {
    it('uses WORKER_CONCURRENCY so feed-pull scales on its own knob', () => {
      expect(resolvePullConcurrency({WORKER_CONCURRENCY: '8'})).toBe(8);
    });

    it('falls back to the documented default when unset', () => {
      expect(resolvePullConcurrency({})).toBe(5);
    });
  });

  describe('docker-compose.prod.yml', () => {
    it('pins worker-label to a single replica (the global-cap invariant)', () => {
      const services = composeServices('docker-compose.prod.yml');
      expect(services['worker-label'].deploy?.replicas).toBe(1);
    });
  });

  describe('docker-compose.yml (base)', () => {
    const services = composeServices('docker-compose.yml');

    it('replaces the single worker with two distinct entrypoints', () => {
      expect(services.worker).toBeUndefined();
      expect(services['worker-pull'].command?.join(' ')).toContain(
        'worker-pull.js',
      );
      expect(services['worker-label'].command?.join(' ')).toContain(
        'worker-label.js',
      );
    });
  });
});
