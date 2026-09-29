import { writeFile } from 'node:fs/promises';
import { caseStudy } from '../public/case-data.mjs';

const destination = new URL('../public/docs/synthetic-case.json', import.meta.url);
await writeFile(destination, JSON.stringify(caseStudy, null, 2) + '\n', 'utf8');
console.log(`Exported ${caseStudy.records.length} synthetic records.`);
