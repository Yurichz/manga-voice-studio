import 'dotenv/config';

async function main() {
  if (process.env.DEMO_MODE === 'true') {
    const { startDemo } = await import('./demo.js');

    await startDemo();

    return;
  }

  if (!process.env.BETTER_AUTH_SECRET || !process.env.AI_SECRET) {
    throw new Error('Run scripts/setup.ps1 to create .env');
  }

  const { createApplication } = await import('./core/app/create-application.js');
  const app = await createApplication();

  await app.listen(Number(process.env.API_PORT || 3001), '127.0.0.1');
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
