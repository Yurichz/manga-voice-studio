import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const program = ts.createProgram(parsed.fileNames, parsed.options);
program.getTypeChecker();
const files = new Map(program.getSourceFiles().filter((file) => /[/\\](?:apps[/\\](?:api|worker)|packages[/\\]backend)[/\\]src[/\\]/.test(file.fileName)
  && !file.fileName.includes('/dist/')).map((file) => [path.resolve(file.fileName), file]));
const failures = [];
const graph = new Map();
const classes = new Map();
const registered = new Set();
const models = new Set([...readFileSync('packages/database/prisma/schema.prisma', 'utf8').matchAll(/^model (\w+)/gm)]
  .map((match) => match[1][0].toLowerCase() + match[1].slice(1)));
const decorator = (node, name) => (ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [])
  .find((item) => ts.isCallExpression(item.expression) && ts.isIdentifier(item.expression.expression) && item.expression.expression.text === name);
const report = (file, node, message) => failures.push(`${path.relative(process.cwd(), file.fileName)}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1} ${message}`);
for (const [filename, source] of files) {
  const relative = path.relative(process.cwd(), filename).replaceAll('\\', '/');
  const da = /\/layers\/[^/]+-da\//.test(relative);
  const infrastructure = /\/core\/providers\//.test(relative);
  const edges = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const clause = node.importClause;
      const typeOnly = clause?.isTypeOnly || (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)
        && !clause.name && clause.namedBindings.elements.every((item) => item.isTypeOnly));
      const resolved = ts.resolveModuleName(specifier, filename, parsed.options, ts.sys).resolvedModule?.resolvedFileName;
      if (!typeOnly && resolved && files.has(path.resolve(resolved))) {
        edges.push(path.resolve(resolved));
        if (da && /[/\\]layers[/\\][^/\\]+-(?:bl|cl)[/\\]/.test(resolved)) {
          report(source, node, 'DA cannot import BL/CL at runtime');
        }
      }
      if (relative.endsWith('.controller.ts') && /repositories|\/prisma|@mvs\/database/.test(specifier)) {
        report(source, node, 'Controller must use a BL service');
      }
      if (/apps\/(?:api|worker)/.test(relative) && resolved && /apps[/\\](?:api|worker)/.test(resolved)) {
        const application = relative.split('/')[1];
        if (!resolved.replaceAll('\\', '/').includes(`/apps/${application}/`)) {
          report(source, node, 'Applications must not import each other');
        }
      }
    }
    if (!da && !infrastructure && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const target = node.expression.expression;
      if (ts.isPropertyAccessExpression(target) && models.has(target.name.text)
        && /^(?:find|create|update|delete|upsert|count|aggregate|groupBy)/.test(node.expression.name.text)) {
        report(source, node, 'Model queries belong in DA');
      }
    }
    if (!da && !infrastructure && ts.isTaggedTemplateExpression(node) && /\$queryRaw|\$executeRaw/.test(node.tag.getText(source))) {
      report(source, node, 'SQL belongs in DA');
    }
    if (ts.isClassDeclaration(node) && node.name) {
      classes.set(node.name.text, { source, node });
      if (decorator(node, 'Module')) {
        const moduleDecorator = decorator(node, 'Module');
        const collect = (part) => {
          if (ts.isIdentifier(part)) { registered.add(part.text); }
          ts.forEachChild(part, collect);
        };
        collect(moduleDecorator.expression);
      }
      if (decorator(node, 'Controller') && !/\/core\/app\//.test(relative) && !/\/layers\/[^/]+-bl\//.test(relative)) {
        report(source, node, 'Controller belongs in a BL layer');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  graph.set(filename, edges);
}
for (const [name, { source, node }] of classes) {
  if ((decorator(node, 'Injectable') || decorator(node, 'Controller')) && /[/\\]routes[/\\]/.test(source.fileName) && !registered.has(name)) {
    report(source, node, `${name} is not registered in a Nest module`);
  }
}
const active = new Set();
const visited = new Set();
function checkCycles(file, trail = []) {
  if (active.has(file)) { failures.push('Runtime import cycle: ' + [...trail, file].map((item) => path.relative(process.cwd(), item)).join(' -> ')); return; }
  if (visited.has(file)) { return; }
  active.add(file);
  for (const target of graph.get(file) || []) { checkCycles(target, [...trail, file]); }
  active.delete(file);
  visited.add(file);
}
for (const file of graph.keys()) { checkCycles(file); }
assert.equal(failures.length, 0, failures.join('\n'));
console.log(`Architecture passed: ${files.size} files; layers, registrations, queries and runtime imports checked.`);
