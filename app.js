const express = require('express');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;

// Redis connection settings — override via env vars if needed,
// but default to the in-cluster/service DNS name used by Docker
// Compose and Kubernetes alike.
const REDIS_HOST = process.env.REDIS_HOST || 'redis-service';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const redisClient = createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    // Retry connecting for a while in case Redis isn't ready yet
    // (e.g. containers starting up together in Compose/K8s).
    reconnectStrategy: (retries) => {
      if (retries > 20) {
        console.error('Too many retries connecting to Redis, giving up.');
        return new Error('Could not connect to Redis');
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err.message));
redisClient.on('connect', () => console.log(`Connecting to Redis at ${REDIS_HOST}:${REDIS_PORT}...`));
redisClient.on('ready', () => console.log('Redis client ready.'));

async function start() {
  await redisClient.connect();

  // Serve the static HTML/CSS/JS frontend from the public/ folder.
  app.use(express.static('public'));

  // Plain-text version, handy for curl/scripting.
  app.get('/hits', async (req, res) => {
    try {
      const hits = await redisClient.incr('hits');
      res.send(`This page has been visited ${hits} time(s).\n`);
    } catch (err) {
      console.error('Error incrementing hits:', err);
      res.status(500).send('Error talking to Redis\n');
    }
  });

  // JSON API the frontend page calls to fetch/increment the counter.
  app.get('/api/hits', async (req, res) => {
    try {
      const hits = await redisClient.incr('hits');
      res.json({ hits });
    } catch (err) {
      console.error('Error incrementing hits:', err);
      res.status(500).json({ error: 'Error talking to Redis' });
    }
  });

  // Simple health check endpoint — handy for Docker/Kubernetes probes.
  app.get('/healthz', async (req, res) => {
    try {
      await redisClient.ping();
      res.status(200).send('ok\n');
    } catch (err) {
      res.status(503).send('redis unavailable\n');
    }
  });

  app.listen(PORT, () => {
    console.log(`Visitor counter app listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start app:', err);
  process.exit(1);
});
