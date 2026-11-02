/**
 * Genera data/brand-urls.json a partir de urls.txt (las URLs del sitemap de es_MX).
 * Uso:  npx ts-node scripts/build-brand-urls.ts ./urls.txt
 *
 * Filtra por prefijo de slug: /es_MX/<marca>-...html
 * Solo son candidatas: si una marca comparte prefijo con otra (ej. "anua" y "anuagroup"),
 * revisa el resultado a ojo.
 */
import fs from 'fs';
import path from 'path';
import { BRANDS } from '../src/services/scraper.service';

const input = process.argv[2] || 'urls.txt';
const urls = fs.readFileSync(input, 'utf-8').split('\n').map((l) => l.trim()).filter(Boolean);

const result: Record<string, string[]> = {};
for (const brand of BRANDS) {
    const prefix = `/es_MX/${brand.slug}-`;
    result[brand.slug] = urls.filter((u) => u.includes(prefix) && u.endsWith('.html')).sort();
    console.log(`${brand.slug}: ${result[brand.slug].length} productos`);
}

const out = path.join(process.cwd(), 'data', 'brand-urls.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(`Guardado en ${out}`);