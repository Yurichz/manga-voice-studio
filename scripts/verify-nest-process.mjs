import { createApplication } from '../dist/apps/api/src/core/app/create-application.js';
import { createWorker } from '../dist/apps/worker/src/core/app/create-worker.js';

const mode = process.argv[2];
const app = mode === 'api' ? await createApplication() : await createWorker();
if (mode === 'api') { await app.listen(Number(process.env.API_PORT), '127.0.0.1'); }
process.send?.({ ready: true });
process.on('message', async (message) => {
  if (message === 'close') {
    await app.close();
    process.send?.({ closed: true });
    process.disconnect();
  }
});
