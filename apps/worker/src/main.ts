import 'dotenv/config';
import { createWorker } from './core/app/create-worker.js';

createWorker().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
