import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {Workshop} from '../lib/workshop.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const workshop = new Workshop(root);
  await workshop.execute(process.argv.slice(2));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
