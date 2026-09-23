import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parsers } from 'prettier/plugins/typescript';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const failures = [];
const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? files(target) : [target];
      }),
    )
  ).flat();
}
function imports(node, result = []) {
  if (!node || typeof node !== 'object') return result;
  if (
    [
      'ImportDeclaration',
      'ExportNamedDeclaration',
      'ExportAllDeclaration',
      'ImportExpression',
    ].includes(node.type) &&
    node.source
  )
    result.push(node.source.value);
  if (node.type === 'TSImportType') result.push(node.argument?.value ?? node.parameter?.value);
  if (node.type === 'CallExpression' && node.callee?.name === 'require')
    result.push(node.arguments[0]?.value);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'comments' || key === 'tokens') continue;
    if (Array.isArray(value)) value.forEach((child) => imports(child, result));
    else if (value && typeof value === 'object') imports(value, result);
  }
  return result;
}
for (const file of await files(root)) {
  if (!/\.tsx?$/.test(file)) continue;
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const layer = relative.split('/')[0];
  const source = await readFile(file, 'utf8');
  const tree = await parsers.typescript.parse(source);
  const fail = (message) => failures.push(`${relative}: ${message}`);
  for (const specifier of imports(tree)) {
    if (typeof specifier !== 'string') {
      fail('Use literal module paths so boundaries can be checked.');
      continue;
    }
    const resolved = specifier.startsWith('@/')
      ? path.join(root, specifier.slice(2))
      : specifier.startsWith('.')
        ? path.resolve(path.dirname(file), specifier)
        : null;
    const target = resolved ? path.relative(root, resolved).replaceAll('\\', '/') : null;
    const targetLayer = target?.split('/')[0];
    if (target && target.startsWith('..')) fail(`Import leaves src: ${specifier}`);
    if (targetLayer && layer === 'frontend' && !['frontend', 'shared'].includes(targetLayer))
      fail(`Frontend cannot import ${specifier}`);
    if (targetLayer && layer === 'backend' && !['backend', 'shared'].includes(targetLayer))
      fail(`Backend cannot import ${specifier}`);
    if (targetLayer && layer === 'shared' && targetLayer !== 'shared')
      fail(`Shared cannot import ${specifier}`);
    if (!resolved && layer === 'shared' && specifier !== 'zod')
      fail(`Shared must stay platform-independent: ${specifier}`);
    if (
      layer === 'frontend' &&
      (specifier.startsWith('@prisma/') ||
        specifier === 'server-only' ||
        builtins.has(specifier.replace(/^node:/, '')))
    )
      fail(`Server dependency in frontend: ${specifier}`);
    if (
      layer === 'frontend' &&
      specifier.startsWith('@supabase/') &&
      !relative.startsWith('frontend/auth/')
    )
      fail('Keep the browser auth SDK inside frontend/auth.');
    if (layer === 'backend' && /^(react|react-dom|lucide-react)(\/|$)/.test(specifier))
      fail(`UI dependency in backend: ${specifier}`);
    if (layer === 'app' && targetLayer) {
      const allowed =
        relative.startsWith('app/api/') || relative === 'app/session/route.ts'
          ? ['backend', 'shared']
          : ['frontend', 'shared', ...(relative === 'app/[[...page]]/page.tsx' ? ['backend'] : [])];
      if (!allowed.includes(targetLayer)) fail(`Route adapter cannot import ${specifier}`);
    }
  }
  if (layer === 'frontend' && !relative.startsWith('frontend/api/') && /\bfetch\s*\(/.test(source))
    fail('Keep HTTP requests in frontend/api.');
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else
  console.log('Architecture boundaries passed: backend, frontend, shared, and route adapters.');
