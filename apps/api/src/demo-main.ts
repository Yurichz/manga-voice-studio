import { startDemo } from './demo.js';

startDemo().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
