import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EstudioCloudModel, fechaMadrid, leerTemario, leerProgreso, progresoVacio,
} from '../src/app/estudio-cloud.model.ts';

const seed = [{
  codigo: 'test', nombre: 'Prueba', libro: 'Libro',
  examenSemana1: '2027-01-26T11:30:00', examenSemana2: '2027-02-09T18:30:00',
  temas: [{ titulo: 'Padre', hijos: [{ titulo: 'A' }, { titulo: 'B' }] }],
}];
const today = new Date('2026-10-19T08:00:00Z');

test('marks descendants, recomputes ancestors and counts leaves only', () => {
  const model = new EstudioCloudModel(seed);
  const root = model.detalles(progresoVacio(), today)[0].temario[0];
  let p = model.marcar(progresoVacio(), root.id, true, today);
  const done = model.detalles(p, today)[0];
  assert.equal(done.resumen.totalApartados, 2);
  assert.equal(done.resumen.apartadosEstudiados, 2);
  assert.equal(done.temario[0].estudiado, true);
  assert.deepEqual(model.actividad(p), [{ fecha: '2026-10-19', asignaturaId: 1, apartados: 2 }]);
  p = model.marcar(p, root.hijos[0].id, false, today);
  assert.equal(model.detalles(p, today)[0].temario[0].estudiado, false);
  assert.equal(model.detalles(p, today)[0].resumen.apartadosEstudiados, 1);
});

test('retains previous study dates and clears them when unmarked', () => {
  const model = new EstudioCloudModel(seed);
  const root = model.detalles(progresoVacio())[0].temario[0];
  let p = model.marcar(progresoVacio(), root.hijos[0].id, true, today);
  p = model.marcar(p, root.id, true, new Date('2026-10-20T08:00:00Z'));
  const detalle = model.detalles(p, today)[0];
  assert.equal(detalle.temario[0].hijos[0].fechaEstudiado, '2026-10-19');
  assert.equal(detalle.temario[0].hijos[1].fechaEstudiado, '2026-10-20');
  p = model.marcar(p, root.id, false);
  assert.deepEqual(model.actividad(p), []);
  assert.deepEqual(p.estudiados, {});
});

test('exam weeks, dates in Madrid, and countdown match backend semantics', () => {
  const model = new EstudioCloudModel(seed);
  const p = model.cambiarSemana(progresoVacio(), 1, 2);
  const resumen = model.detalles(p, new Date('2027-02-08T23:30:00Z'))[0].resumen;
  assert.equal(resumen.semanaElegida, 2);
  assert.equal(resumen.fechaExamen, seed[0].examenSemana2);
  assert.equal(resumen.diasRestantes, 0);
  assert.equal(fechaMadrid(new Date('2026-10-18T22:30:00Z')), '2026-10-19');
});

test('title paths preserve study progress when nodes are inserted', () => {
  const first = new EstudioCloudModel(seed);
  const leaf = first.detalles(progresoVacio())[0].temario[0].hijos[0];
  const p = first.marcar(progresoVacio(), leaf.id, true, today);
  const changed = structuredClone(seed);
  changed[0].temas.unshift({ titulo: 'Nuevo' });
  const second = new EstudioCloudModel(changed);
  const old = second.detalles(p, today)[0].temario[1].hijos[0];
  assert.equal(old.estudiado, true);
  assert.notEqual(old.id, leaf.id);
});

test('rejects malformed progress, invalid dates and nonexistent entities', () => {
  const model = new EstudioCloudModel(seed);
  assert.throws(() => leerProgreso({ version: 2 }), /formato/);
  assert.throws(() => leerProgreso({ version: 1, semanas: { test: 3 }, estudiados: {} }), /Semana/);
  assert.throws(() => leerProgreso({ version: 1, semanas: {}, estudiados: { a: '2026-02-30' } }), /Fecha/);
  assert.throws(() => model.marcar(progresoVacio(), -1, true), /encontrado/);
  assert.throws(() => model.cambiarSemana(progresoVacio(), 99, 1), /encontrada/);
  assert.throws(() => leerTemario({}), /temario/);
});

test('loads the real shared syllabus and computes a consistent empty tree', () => {
  const json = JSON.parse(readFileSync(new URL('../../backend/src/main/resources/temario.json', import.meta.url), 'utf8'));
  const model = new EstudioCloudModel(leerTemario(json));
  const detalles = model.detalles(progresoVacio(), today);
  assert.equal(detalles.length, 2);
  assert.ok(detalles.every((d) => d.resumen.totalApartados > 0 && d.resumen.apartadosEstudiados === 0));
  for (const detalle of detalles) {
    let p = progresoVacio();
    for (const root of detalle.temario) p = model.marcar(p, root.id, true, today);
    const done = model.detalles(p, today).find((d) => d.resumen.id === detalle.resumen.id);
    assert.equal(done.resumen.apartadosEstudiados, done.resumen.totalApartados);
    assert.equal(model.actividad(p).reduce((n, d) => n + d.apartados, 0), done.resumen.totalApartados);
  }
});
