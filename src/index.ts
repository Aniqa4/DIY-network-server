import env from './config/env';
import app from './app';
import prisma from './lib/prisma';

async function main() {
  await prisma.$connect();
  app.listen(env.port, () => {
    console.log(`API running at http://localhost:${env.port}/api/v1`);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
