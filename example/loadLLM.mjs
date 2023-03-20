import path from 'node:path';
import { AlpacaCppChat } from '../dist/index.js';

const alpaca = new AlpacaCppChat({
  cwd: path.join(__dirname, '../dist'),
  modelParameters: { model: path.join(__dirname, '../model/ggml-alpaca-7b-q4.bin') },
});
const response = await alpaca.generate(['Say "hello world"']).catch((error) => console.error(error));

console.log(`response`, response, JSON.stringify(response));
