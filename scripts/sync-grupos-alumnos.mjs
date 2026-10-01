#!/usr/bin/env node
/** Sincroniza grupos_cohortes faltantes desde usuarios.grupo_cohorte. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

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

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'imcyc_user',
  password: process.env.DB_PASSWORD || 'imcyc_password',
  database: process.env.DB_NAME || 'academia_imcyc',
  port: parseInt(process.env.DB_PORT || '3306', 10),
});

async function nextGroupCode() {
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

try {
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

  if (orphans.length === 0) {
    console.log('Todos los grupos de alumnos ya existen en grupos_cohortes.');
  } else {
    for (const row of orphans) {
      const codigo = await nextGroupCode();
      await pool.execute(
        'INSERT INTO grupos_cohortes (nombre, codigo, creador_id) VALUES (?, ?, NULL)',
        [row.nombre.trim(), codigo]
      );
      console.log(`Creado: ${row.nombre} → ${codigo}`);
    }
  }

  const [grupos] = await pool.execute(
    `SELECT g.nombre, g.codigo,
            (SELECT COUNT(*) FROM usuarios u WHERE u.grupo_cohorte = g.nombre AND u.role_id = 3) AS alumnos
     FROM grupos_cohortes g ORDER BY g.nombre`
  );
  console.log('\nGrupos actuales:');
  for (const g of grupos) {
    console.log(`  ${g.nombre} (${g.codigo}) — ${g.alumnos} alumno(s)`);
  }
} finally {
  await pool.end();
}
