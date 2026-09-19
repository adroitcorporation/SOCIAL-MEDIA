import { readFile } from 'node:fs/promises';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import YAML from 'yaml';
const response = await fetch('https://render.com/schema/render.yaml.json');
if (!response.ok) throw new Error(`Cannot fetch Render schema: ${response.status}`);
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(await response.json());
const valid = validate(YAML.parse(await readFile('render.yaml', 'utf8')));
if (!valid) {
  console.error(validate.errors);
  process.exit(1);
}
console.log('render.yaml matches the official Render Blueprint JSON schema.');
