import {createBullBoard} from '@bull-board/api';
import {BullMQAdapter} from '@bull-board/api/bullMQAdapter';
import {ExpressAdapter} from '@bull-board/express';
import {Queue} from 'bullmq';
import express from 'express';
import basicAuth from 'express-basic-auth';
import {redisConnectionOptions} from './infra/cache/redis';
import {ALL_QUEUES} from './infra/queues/queues';

/**
 * Standalone Bull Board (the ready-made queue panel from US-12), protected by
 * basic auth with credentials from env. It shares the backend image but runs as
 * its own process/service.
 */
function start(): void {
  const password = process.env.BULL_BOARD_PASSWORD;
  if (!password) {
    process.stderr.write('BULL_BOARD_PASSWORD is required\n');
    process.exit(1);
  }
  const user = process.env.BULL_BOARD_USER ?? 'admin';
  const port = Number(process.env.BULL_BOARD_PORT ?? 3001);

  const connection = redisConnectionOptions();
  const queues = ALL_QUEUES.map(
    name => new BullMQAdapter(new Queue(name, {connection})),
  );

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/');
  createBullBoard({queues, serverAdapter});

  const app = express();
  // Unauthenticated liveness endpoint for the container health check.
  app.get('/healthz', (_req, res) =>
    res.json({ok: true, service: 'bull-board'}),
  );
  app.use(basicAuth({users: {[user]: password}, challenge: true}));
  app.use('/', serverAdapter.getRouter());

  app.listen(port, '0.0.0.0', () =>
    process.stdout.write(
      JSON.stringify({level: 'info', msg: 'bull-board.listening', port}) + '\n',
    ),
  );
}

start();
