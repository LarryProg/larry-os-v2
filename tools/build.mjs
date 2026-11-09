// Compila src/crm.jsx -> js/crm.js (React sin Babel en el navegador).
// Uso: node tools/build.mjs   (o doble clic en build.bat)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Babel = require('./babel.min.js');

const src = fs.readFileSync(path.join(root, 'src/crm.jsx'), 'utf8');
const { code } = Babel.transform(src, { presets: ['react'], sourceType: 'script', compact: false, retainLines: true });
const header = '// ARCHIVO GENERADO desde src/crm.jsx — no editar a mano. Ejecutar build.bat después de cambiar el JSX.\n';

fs.writeFileSync(path.join(root, 'js/crm.js'), header + code + '\n');
console.log('OK js/crm.js', code.length, 'bytes');
