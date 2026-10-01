#!/usr/bin/env node
/**
 * ponytail: mirrors the OR logic in src/lib/cursoGrupos.ts estudiantePuedeAccederCurso.
 * Upgrade path: integration test against MySQL with real curso_estudiantes / curso_grupos rows.
 */

function evaluarAcceso({ directa, porGrupo, aprobado }) {
  if (!aprobado) return false;
  return directa || porGrupo;
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

// Sin grupo ni inscripción directa => sin acceso
assert(
  evaluarAcceso({ directa: false, porGrupo: false, aprobado: true }) === false,
  'sin vías de acceso'
);

// Inscripción directa sin grupo => acceso
assert(
  evaluarAcceso({ directa: true, porGrupo: false, aprobado: true }) === true,
  'inscripción directa'
);

// Solo por grupo => acceso
assert(
  evaluarAcceso({ directa: false, porGrupo: true, aprobado: true }) === true,
  'acceso por grupo'
);

// Curso no aprobado => sin acceso aunque esté inscrito
assert(
  evaluarAcceso({ directa: true, porGrupo: true, aprobado: false }) === false,
  'curso no aprobado'
);

console.log('check-acceso: OK (4 casos)');

/** ponytail: lógica espejo de pendientes en estudiante/clases route */
function contarPendientes(clases, examenes) {
  let n = 0;
  for (const c of clases) {
    if (c.requiere_tarea && !c.entrega_id) n++;
  }
  for (const ex of examenes) {
    if (!ex.intento_fecha && ex.mi_calificacion == null) n++;
  }
  return n;
}

const clasesConTareaSinEntrega = [
  { requiere_tarea: 1, entrega_id: null },
  { requiere_tarea: 1, entrega_id: 5 },
  { requiere_tarea: 0, entrega_id: null },
];
const examenesSinIntento = [
  { intento_fecha: null, mi_calificacion: null },
  { intento_fecha: '2026-01-01', mi_calificacion: 80 },
];

assert(
  contarPendientes(clasesConTareaSinEntrega, examenesSinIntento) === 2,
  'pendientes: tarea sin entrega + examen sin intento'
);
assert(
  contarPendientes(
    [{ requiere_tarea: 1, entrega_id: 1 }],
    [{ intento_fecha: '2026-01-01', mi_calificacion: 90 }]
  ) === 0,
  'pendientes: todo entregado'
);

console.log('check-acceso pendientes: OK (2 casos)');
