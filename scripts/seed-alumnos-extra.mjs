#!/usr/bin/env node
/**
 * Crea 3 alumnos de prueba si no existen. Ejecutar en servidor:
 *   node scripts/seed-alumnos-extra.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const ALUMNOS = [
  {
    email: 'alumno2@imcyc.com',
    nombres: 'María',
    apellido_paterno: 'García',
    apellido_materno: 'López',
    fecha_nacimiento: '1998-03-15',
    grupo_cohorte: 'Diplomado Concreto 2026-A',
  },
  {
    email: 'alumno3@imcyc.com',
    nombres: 'Carlos',
    apellido_paterno: 'Ramírez',
    apellido_materno: 'Sánchez',
    fecha_nacimiento: '1999-07-22',
    grupo_cohorte: 'Diplomado Concreto 2026-A',
  },
  {
    email: 'alumno4@imcyc.com',
    nombres: 'Ana',
    apellido_paterno: 'Martínez',
    apellido_materno: 'Ruiz',
    fecha_nacimiento: '2000-11-08',
    grupo_cohorte: 'Diplomado Concreto 2026-B',
  },
];

function clean(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '');
}

function buildPassword(idEstudiante, nombres, pat, mat, fNac) {
  const cleanId = clean(idEstudiante);
  const idPart = cleanId.length >= 2 ? cleanId[0] + cleanId[cleanId.length - 1] : cleanId;
  const patPart = clean(pat).substring(0, 2);
  const matPart = clean(mat).substring(0, 2);
  const firstName = clean(nombres).split(' ')[0];
  const nombrePart = firstName.substring(0, 2);
  const dayPart = fNac.split('-')[2] || '01';
  return `${idPart}${patPart}${matPart}${nombrePart}${dayPart}`;
}

async function nextGroupCode(pool) {
  const [rows] = await pool.execute(
    `SELECT codigo FROM grupos_cohortes WHERE codigo REGEXP '^GRP-[0-9]+$'`
  );
  let maxNum = 0;
  for (const row of rows) {
    const match = row.codigo.match(/^GRP-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  return `GRP-${String(maxNum + 1).padStart(4, '0')}`;
}

async function ensureGrupo(pool, nombre) {
  const trimmed = nombre.trim();
  if (!trimmed) return;
  const [rows] = await pool.execute('SELECT id FROM grupos_cohortes WHERE nombre = ?', [trimmed]);
  if (rows.length > 0) return;
  const codigo = await nextGroupCode(pool);
  await pool.execute(
    'INSERT INTO grupos_cohortes (nombre, codigo, creador_id) VALUES (?, ?, NULL)',
    [trimmed, codigo]
  );
  console.log(`Grupo creado: ${trimmed} (${codigo})`);
}

async function syncOrphanGrupos(pool) {
  const [orphans] = await pool.execute(
    `SELECT DISTINCT u.grupo_cohorte AS nombre
     FROM usuarios u
     WHERE u.role_id = 3
       AND u.grupo_cohorte IS NOT NULL
       AND TRIM(u.grupo_cohorte) != ''
       AND NOT EXISTS (
         SELECT 1 FROM grupos_cohortes g WHERE g.nombre = u.grupo_cohorte
       )`
  );
  for (const row of orphans) {
    await ensureGrupo(pool, row.nombre);
  }
}

async function nextStudentId(pool) {
  const [rows] = await pool.execute(
    `SELECT id_estudiante FROM usuarios
     WHERE id_estudiante IS NOT NULL AND id_estudiante REGEXP '^EST-[0-9]+$'`
  );
  let maxNum = 0;
  for (const row of rows) {
    const match = row.id_estudiante.match(/^EST-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  return `EST-${String(maxNum + 1).padStart(4, '0')}`;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'imcyc_user',
  password: process.env.DB_PASSWORD || 'imcyc_password',
  database: process.env.DB_NAME || 'academia_imcyc',
  port: parseInt(process.env.DB_PORT || '3306', 10),
});

try {
  const created = [];
  for (const a of ALUMNOS) {
    const [existing] = await pool.execute('SELECT id, id_estudiante FROM usuarios WHERE email = ?', [a.email]);
    if (existing.length > 0) {
      console.log(`SKIP ${a.email} (ya existe, ${existing[0].id_estudiante || 'sin ID'})`);
      continue;
    }

    const id_estudiante = await nextStudentId(pool);
    const nombre = `${a.nombres} ${a.apellido_paterno} ${a.apellido_materno}`.trim();
    const password = buildPassword(id_estudiante, a.nombres, a.apellido_paterno, a.apellido_materno, a.fecha_nacimiento);
    const hashed = await bcrypt.hash(password, 10);

    await pool.execute(
      `INSERT INTO usuarios (role_id, email, password, nombre, grupo_cohorte, id_estudiante, apellido_paterno, apellido_materno, fecha_nacimiento)
       VALUES (3, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.email, hashed, nombre, a.grupo_cohorte, id_estudiante, a.apellido_paterno, a.apellido_materno, a.fecha_nacimiento]
    );

    if (a.grupo_cohorte) await ensureGrupo(pool, a.grupo_cohorte);

    created.push({ email: a.email, id_estudiante, password, nombre, grupo: a.grupo_cohorte });
    console.log(`OK ${a.email} → ${id_estudiante} / contraseña: ${password}`);
  }

  await syncOrphanGrupos(pool);

  if (created.length === 0) {
    console.log('Ningún alumno nuevo (los 3 ya existían).');
  } else {
    console.log(`\n${created.length} alumno(s) creado(s).`);
  }
} finally {
  await pool.end();
}
