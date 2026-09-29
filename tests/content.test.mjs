import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { schemaGroups, profiles, invariants } from '../public/schema-data.mjs';
import { caseStudy } from '../public/case-data.mjs';
import { createStaticServer } from '../server.mjs';

// These checks validate the shipped teaching content and its cross-references.
// The compact demonstration records are not instances of the full v3 contract.
const nonempty = (value, label) => assert.ok(typeof value === 'string' && value.trim().length > 0, label);
const snapshotKey = reference => JSON.stringify([reference.id, reference.revision]);
const snapshots = new Map(caseStudy.records.map(record => [snapshotKey(record.data), record]));
const frontendRecords = new Map(caseStudy.records.map(record => [record.id, record]));

function unique(values, label) {
  const duplicates = [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
  assert.equal(duplicates.length, 0, `${label} must be unique; duplicates: ${duplicates.join(', ')}`);
  values.forEach(value => nonempty(value, `${label}: empty value`));
}

function walk(value, visit, location = '') {
  if (!value || typeof value !== 'object') return;
  if (!Array.isArray(value)) visit(value, location);
  for (const [key, child] of Object.entries(value)) walk(child, visit, `${location}/${key}`);
}

function resolve(reference, location) {
  nonempty(reference?.id, `${location}: logical id is required`);
  nonempty(reference?.revision, `${location}: exact revision is required`);
  assert.ok(!['latest', 'main', 'master', 'HEAD'].includes(reference.revision), `${location}: mutable revision alias`);
  const record = snapshots.get(snapshotKey(reference));
  assert.ok(record, `${location}: unresolved ${reference.id}@${reference.revision}`);
  return record;
}

function assertPointer(record, pointer, location) {
  assert.ok(typeof pointer === 'string' && (pointer === '' || pointer.startsWith('/')), `${location}: invalid JSON Pointer`);
  if (pointer === '') return;
  let current = record;
  for (const escaped of pointer.slice(1).split('/')) {
    assert.ok(!/~(?:[^01]|$)/u.test(escaped), `${location}: invalid JSON Pointer escape`);
    const segment = escaped.replace(/~1/gu, '/').replace(/~0/gu, '~');
    assert.ok(current !== null && typeof current === 'object' && Object.hasOwn(current, segment), `${location}: ${pointer} does not exist`);
    current = current[segment];
  }
}

function assertAcyclic(links, label) {
  const adjacency = new Map();
  for (const { from, to } of links) {
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    if (!adjacency.has(to)) adjacency.set(to, new Set());
    adjacency.get(from).add(to);
  }
  const active = new Set();
  const complete = new Set();
  function visit(node, chain = []) {
    assert.ok(!active.has(node), `${label}: cycle ${[...chain, node].join(' -> ')}`);
    if (complete.has(node)) return;
    active.add(node);
    for (const next of adjacency.get(node)) visit(next, [...chain, node]);
    active.delete(node);
    complete.add(node);
  }
  for (const node of adjacency.keys()) visit(node);
}

test('schema field paths are unique per entity and conditional requirements are explained', () => {
  assert.ok(schemaGroups.length > 0);
  unique(schemaGroups.map(group => group.id), 'schema group IDs');
  for (const group of schemaGroups) {
    assert.ok(group.fields.length > 0, group.id);
    unique(group.fields.map(field => field.path), `${group.id} field paths`);
    for (const field of group.fields) {
      const label = `${group.id}.${field.path}`;
      nonempty(field.type, `${label}: type`);
      nonempty(field.description, `${label}: description`);
      assert.ok(['required', 'conditional', 'optional'].includes(field.required), `${label}: unknown requirement`);
      if (field.required === 'conditional') nonempty(field.condition, `${label}: condition must be stated`);
      else assert.ok(!field.condition, `${label}: unconditional field must not contain an ambiguous condition`);
    }
  }
  for (const [label, rows] of [['profile', profiles], ['invariant', invariants]]) unique(rows.map(row => row.id), `${label} IDs`);
  for (const profile of profiles) {
    assert.ok(profile.required.length > 0, `${profile.id}: required guidance`);
    [...profile.required, ...profile.optional].forEach(item => nonempty(item, profile.id));
  }
});

test('frontend IDs, stage edges, evidence buttons and affected entity labels resolve', () => {
  unique(caseStudy.records.map(record => record.id), 'frontend record IDs');
  unique(caseStudy.records.map(record => snapshotKey(record.data)), 'logical id/revision pairs');
  unique(caseStudy.stages.map(stage => stage.id), 'stage IDs');
  unique(caseStudy.stressTests.map(item => item.id), 'stress-test IDs');
  const entityIDs = new Set(schemaGroups.map(group => group.id));
  const entityLabels = new Set(schemaGroups.map(group => group.english));
  for (const record of caseStudy.records) {
    assert.ok(entityIDs.has(record.kind), `${record.id}: unknown record kind`);
    assert.equal(record.revision, record.data.revision, `${record.id}: display revision differs from snapshot`);
  }
  for (const stage of caseStudy.stages) {
    assert.ok(Array.isArray(stage.links), stage.id);
    for (const link of stage.links) {
      assert.ok(frontendRecords.has(link.from), `${stage.id}: unknown from ${link.from}`);
      assert.ok(frontendRecords.has(link.to), `${stage.id}: unknown to ${link.to}`);
      nonempty(link.label, `${stage.id}: edge label`);
    }
    assert.deepEqual(stage.record, resolve(stage.record, stage.id).data, `${stage.id}: displayed JSON differs from its registered snapshot`);
  }
  for (const question of caseStudy.questions) {
    for (const id of question.evidence) assert.ok(frontendRecords.has(id), `${question.question}: unknown evidence ${id}`);
  }
  // affected contains entity display labels, not record IDs; app.mjs renders chips.
  for (const stress of caseStudy.stressTests) {
    for (const label of stress.affected) assert.ok(entityLabels.has(label), `${stress.id}: unknown affected entity ${label}`);
  }
});

test('every nested logical reference resolves to one exact registered snapshot', () => {
  let count = 0;
  for (const record of caseStudy.records) {
    resolve(record.data, record.id);
    walk(record.data, (value, location) => {
      if (Object.hasOwn(value, 'ref')) resolve(value.ref, `${record.id}${location}/ref`);
      if (location && Object.hasOwn(value, 'id')) {
        resolve(value, `${record.id}${location}`);
        count++;
      }
    });
  }
  assert.ok(count > 0, 'the fixture must exercise nested references');
});

test('target JSON Pointers and assessment criterion keys address actual content', () => {
  for (const record of caseStudy.records) {
    walk(record.data, (value, location) => {
      if (value.ref && Object.hasOwn(value, 'path')) {
        assertPointer(resolve(value.ref, `${record.id}${location}`).data, value.path, `${record.id}${location}`);
      }
    });
    if (record.kind === 'assessment') {
      const evaluator = resolve(record.data.criterion.evaluator, `${record.id}.criterion.evaluator`);
      assert.equal(evaluator.data.kind, 'evaluator', `${record.id}: criterion must reference an evaluator`);
      const criteria = evaluator.data.data.criteria;
      unique(criteria.map(criterion => criterion.key), `${evaluator.id} criterion keys`);
      assert.ok(criteria.some(criterion => criterion.key === record.data.criterion.key), `${record.id}: undefined criterion ${record.data.criterion.key}`);
      const result = record.data.result;
      assert.ok(['value', 'unavailable'].includes(result.status), `${record.id}: unknown result status`);
      assert.equal(Object.hasOwn(result, 'value'), result.status === 'value', `${record.id}: invalid result value branch`);
      if (result.status === 'unavailable') nonempty(result.reason, `${record.id}: unavailable reason`);
      else assert.ok(!Object.hasOwn(result, 'reason'), `${record.id}: value and unavailable reason must not coexist`);
    }
  }
});

test('each explanatory stage graph and the combined storyline are acyclic', () => {
  for (const stage of caseStudy.stages) assertAcyclic(stage.links, stage.id);
  assertAcyclic(caseStudy.stages.flatMap(stage => stage.links), 'combined storyline');
});

test('revision parents resolve within the same object and cannot create an ancestry cycle', () => {
  const links = [];
  for (const record of caseStudy.records) {
    for (const parent of record.data.parents ?? []) {
      const previous = resolve(parent, `${record.id}.parents`);
      assert.equal(previous.data.id, record.data.id, `${record.id}: parent belongs to another logical object`);
      assert.equal(previous.kind, record.kind, `${record.id}: parent changes entity kind`);
      links.push({ from: snapshotKey(previous.data), to: snapshotKey(record.data) });
    }
  }
  assertAcyclic(links, 'revision ancestry');
});

test('the downloadable JSON exactly matches the current case study', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../public/docs/synthetic-case.json', import.meta.url), 'utf8'));
  assert.deepEqual(snapshot, caseStudy, 'case-data.mjs changed; run npm run build to refresh the downloadable case');
});

test('shipped navigation, downloads and module imports are served by the production entrypoint', async t => {
  const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
  const server = await createStaticServer({ publicDir });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  const html = await page.text();
  const ids = [...html.matchAll(/\bid="([^"]+)"/gu)].map(match => match[1]);
  unique(ids, 'HTML IDs');
  const routes = new Set();
  for (const [, link] of html.matchAll(/\b(?:href|src)="([^"]+)"/gu)) {
    if (link.startsWith('#')) assert.ok(ids.includes(link.slice(1)), `unresolved navigation ${link}`);
    else if (link.startsWith('/')) routes.add(link);
  }
  const visited = new Set();
  while (routes.size > 0) {
    const route = routes.values().next().value;
    routes.delete(route);
    if (visited.has(route)) continue;
    visited.add(route);
    const response = await fetch(new URL(route, base));
    assert.equal(response.status, 200, `unserved linked resource ${route}`);
    const body = await response.text();
    assert.ok(body.length > 0, `empty linked resource ${route}`);
    if (route.endsWith('.md')) assert.match(response.headers.get('content-type'), /^text\/markdown/u);
    if (route.endsWith('.mjs') || route.endsWith('.js')) {
      assert.match(response.headers.get('content-type'), /^text\/javascript/u, route);
      for (const [, dependency] of body.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        assert.ok(dependency.startsWith('.'), `${route}: external module is incompatible with the self-only deployment`);
        routes.add(new URL(dependency, new URL(route, base)).pathname);
      }
    }
  }
  const health = await fetch(`${base}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
  const railway = JSON.parse(await readFile(new URL('../railway.json', import.meta.url), 'utf8'));
  assert.equal(railway.deploy.healthcheckPath, '/healthz', 'declared deployment health path must be live');
});
