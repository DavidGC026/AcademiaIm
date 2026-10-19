import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateAcademicAverage } from '../src/lib/academicAverage';
import { getSessionAudience, getSessionCookieName, getSessionCookiePath } from '../src/lib/sessionConfig';
import { signToken, verifyToken, type JWTPayload } from '../src/lib/auth';

test('sin calificaciones se devuelve null; una nota cero conserva su valor', () => {
  assert.equal(calculateAcademicAverage({ avg_grade: null, count_grade: 0 }), null);
  assert.equal(calculateAcademicAverage({ avg_grade: '0', count_grade: 1 }), '0.0');
  assert.equal(calculateAcademicAverage({ avg_grade: null, count_grade: 0 }, { avg_grade: 80, count_grade: 2 }), '80.0');
});

test('el promedio conserva la fórmula de categorías previa', () => {
  assert.equal(calculateAcademicAverage({ avg_grade: '60', count_grade: 4 }, { avg_grade: '100', count_grade: 1 }), '80.0');
});

test('las dos aplicaciones del mismo dominio conservan cookies y audiencias independientes', () => {
  assert.notEqual(getSessionCookieName('/Academia'), getSessionCookieName('/ruadiplo'));
  assert.notEqual(getSessionAudience('/Academia'), getSessionAudience('/ruadiplo'));
  assert.equal(getSessionCookiePath('/Academia/'), '/Academia');
  assert.equal(getSessionCookiePath('/ruadiplo'), '/ruadiplo');
  assert.equal(getSessionCookiePath(''), '/');
});

test('actualizar el nombre renueva la sesión sin reutilizar exp, iat o aud anteriores', () => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'clave-ficticia-exclusiva-de-esta-prueba';
  try {
    const payload: JWTPayload = { userId: 1, email: 'qa@example.test', nombre: 'QA', roleId: 3, roleName: 'estudiante', grupo_cohorte: null };
    const session = verifyToken(signToken(payload));
    assert.ok(session);
    assert.equal(verifyToken(signToken({ ...session, nombre: 'QA actualizado' }))?.nombre, 'QA actualizado');
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});
