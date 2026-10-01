import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'imcyc_user',
  password: process.env.DB_PASSWORD || 'imcyc_password',
  database: process.env.DB_NAME || 'academia_imcyc',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;

export async function query(sql: string, params?: any[]) {
  const [results] = await pool.execute(sql, params);
  return results;
}

export async function initDb() {
  try {
    console.log('Iniciando base de datos y sembrando datos...');

    // 1. Asegurar roles
    await pool.execute(
      `INSERT INTO roles (id, nombre) VALUES (1, 'administrador') ON DUPLICATE KEY UPDATE nombre=nombre`
    );
    await pool.execute(
      `INSERT INTO roles (id, nombre) VALUES (2, 'maestro') ON DUPLICATE KEY UPDATE nombre=nombre`
    );
    await pool.execute(
      `INSERT INTO roles (id, nombre) VALUES (3, 'estudiante') ON DUPLICATE KEY UPDATE nombre=nombre`
    );

    // 2. Asegurar configuraciones por defecto
    await pool.execute(
      `INSERT INTO configuracion (clave, valor) VALUES ('ia_provider', 'gemini') ON DUPLICATE KEY UPDATE valor=valor`
    );
    await pool.execute(
      `INSERT INTO configuracion (clave, valor) VALUES ('ia_api_key', 'mock_api_key') ON DUPLICATE KEY UPDATE valor=valor`
    );

    // 3. Crear usuarios semilla
    const [users] = (await pool.execute('SELECT id FROM usuarios LIMIT 1')) as any[];
    if (users.length === 0) {
      console.log('Sembrando usuarios por defecto...');

      const adminPassword = await bcrypt.hash('admin123', 10);
      const maestroPassword = await bcrypt.hash('maestro123', 10);
      const estudiantePassword = await bcrypt.hash('estudiante123', 10);

      // Admin
      await pool.execute(
        `INSERT INTO usuarios (role_id, email, password, nombre) VALUES (?, ?, ?, ?)`,
        [1, 'admin@imcyc.com', adminPassword, 'Administrador IMCYC']
      );

      // Maestro
      await pool.execute(
        `INSERT INTO usuarios (role_id, email, password, nombre) VALUES (?, ?, ?, ?)`,
        [2, 'maestro@imcyc.com', maestroPassword, 'Prof. Ingeniero de Concreto']
      );

      // Estudiante
      await pool.execute(
        `INSERT INTO usuarios (role_id, email, password, nombre, grupo_cohorte) VALUES (?, ?, ?, ?, ?)`,
        [3, 'estudiante@imcyc.com', estudiantePassword, 'Juan Pérez Estudiante', 'Diplomado Concreto 2026-A']
      );

      console.log('Usuarios sembrados con éxito.');
    } else {
      console.log('Los usuarios ya existen, omitiendo siembra.');
    }

    // Alter Table usuarios to add student profile fields if they don't exist
    const addColumnSafely = async (columnName: string, sql: string) => {
      try {
        await pool.execute(sql);
        console.log(`Columna ${columnName} agregada exitosamente.`);
      } catch (err: any) {
        if (err.errno === 1060 || err.code === 'ER_DUP_FIELDNAME') {
          // Ignorar error de columna duplicada
          return;
        }
        console.error(`Error al agregar columna ${columnName}:`, err);
      }
    };

    try {
      await addColumnSafely('id_estudiante', `ALTER TABLE usuarios ADD COLUMN id_estudiante VARCHAR(50) DEFAULT NULL`);
      await pool.execute(
        `UPDATE usuarios SET id_estudiante = 'EST-0001' WHERE email = 'estudiante@imcyc.com' AND id_estudiante IS NULL`
      );
      await addColumnSafely('apellido_paterno', `ALTER TABLE usuarios ADD COLUMN apellido_paterno VARCHAR(100) DEFAULT NULL`);
      await addColumnSafely('apellido_materno', `ALTER TABLE usuarios ADD COLUMN apellido_materno VARCHAR(100) DEFAULT NULL`);
      await addColumnSafely('fecha_nacimiento', `ALTER TABLE usuarios ADD COLUMN fecha_nacimiento DATE DEFAULT NULL`);
      await addColumnSafely('foto_perfil', `ALTER TABLE usuarios ADD COLUMN foto_perfil VARCHAR(500) DEFAULT NULL`);
      await addColumnSafely('acceso_biblioteca_prioritario', `ALTER TABLE usuarios ADD COLUMN acceso_biblioteca_prioritario TINYINT(1) DEFAULT 0`);
      // Migración a modelo de pago: el acceso prioritario lo otorga el admin por alumno.
      // Reseteamos el backfill antiguo (todos=1) una sola vez, marcando un flag en configuracion.
      try {
        const [flag] = (await pool.execute(
          `SELECT clave FROM configuracion WHERE clave = 'biblioteca_reset_acceso'`
        )) as any[];
        if (flag.length === 0) {
          await pool.execute(`UPDATE usuarios SET acceso_biblioteca_prioritario = 0 WHERE role_id = 3`);
          await pool.execute(
            `INSERT INTO configuracion (clave, valor) VALUES ('biblioteca_reset_acceso', 'done') ON DUPLICATE KEY UPDATE valor=valor`
          );
        }
      } catch {
        /* ponytail: migración idempotente; si falla se reintenta en el próximo arranque */
      }
      await addColumnSafely('permite_reenvio', `ALTER TABLE entregas_tareas ADD COLUMN permite_reenvio TINYINT(1) DEFAULT 0`);
      await addColumnSafely('clase_en_vivo_url', `ALTER TABLE clases ADD COLUMN clase_en_vivo_url VARCHAR(500) DEFAULT NULL`);
      await addColumnSafely('videos', `ALTER TABLE clases ADD COLUMN videos JSON DEFAULT NULL`);
      await addColumnSafely('tarea_descripcion', `ALTER TABLE clases ADD COLUMN tarea_descripcion TEXT DEFAULT NULL`);
      await addColumnSafely('tarea_recurso_nombre', `ALTER TABLE clases ADD COLUMN tarea_recurso_nombre VARCHAR(255) DEFAULT NULL`);
      await addColumnSafely('tarea_recurso_url', `ALTER TABLE clases ADD COLUMN tarea_recurso_url VARCHAR(500) DEFAULT NULL`);
      await addColumnSafely('tarea_recursos', `ALTER TABLE clases ADD COLUMN tarea_recursos JSON DEFAULT NULL`);
      try {
        await pool.execute(
          `UPDATE clases SET tarea_recursos = JSON_ARRAY(JSON_OBJECT('archivo_url', tarea_recurso_url, 'archivo_nombre', IFNULL(tarea_recurso_nombre, 'Recurso')))
           WHERE tarea_recurso_url IS NOT NULL AND (tarea_recursos IS NULL OR JSON_LENGTH(tarea_recursos) = 0)`
        );
      } catch {
        /* ponytail: backfill idempotente del recurso único legacy */
      }
      await addColumnSafely('referencias', `ALTER TABLE clases ADD COLUMN referencias JSON DEFAULT NULL`);
      await addColumnSafely('presentacion_url', `ALTER TABLE clases ADD COLUMN presentacion_url VARCHAR(500) DEFAULT NULL`);
      await addColumnSafely('presentacion_nombre', `ALTER TABLE clases ADD COLUMN presentacion_nombre VARCHAR(255) DEFAULT NULL`);
      await addColumnSafely('secciones', `ALTER TABLE clases ADD COLUMN secciones JSON DEFAULT NULL`);
      await addColumnSafely('libro_archivo_url', `ALTER TABLE biblioteca_libros ADD COLUMN archivo_url VARCHAR(500) DEFAULT NULL`);
      await addColumnSafely('libro_archivo_nombre', `ALTER TABLE biblioteca_libros ADD COLUMN archivo_nombre VARCHAR(255) DEFAULT NULL`);
      await addColumnSafely('revista_archivo_url', `ALTER TABLE biblioteca_revistas ADD COLUMN archivo_url VARCHAR(500) DEFAULT NULL`);
      await addColumnSafely('revista_archivo_nombre', `ALTER TABLE biblioteca_revistas ADD COLUMN archivo_nombre VARCHAR(255) DEFAULT NULL`);
      await addColumnSafely('revista_del_mes', `ALTER TABLE biblioteca_revistas ADD COLUMN revista_del_mes TINYINT(1) DEFAULT 0`);
      await addColumnSafely('mes_destacado', `ALTER TABLE biblioteca_revistas ADD COLUMN mes_destacado VARCHAR(100) DEFAULT NULL`);
    } catch (colErr) {
      console.error('Error al verificar o alterar columnas:', colErr);
    }


    // 4. Crear tablas de biblioteca si no existen
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS biblioteca_libros (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        autor VARCHAR(255) NOT NULL,
        descripcion TEXT,
        precio DECIMAL(10,2) NOT NULL,
        imagen VARCHAR(500) DEFAULT '/libro_concreto.png',
        paginas INT DEFAULT 0,
        tienda_url VARCHAR(500) DEFAULT 'https://tienda.imcyc.com/products',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS compras_libros (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        libro_id INT NOT NULL,
        openpay_charge_id VARCHAR(100) DEFAULT NULL,
        monto DECIMAL(10,2) NOT NULL DEFAULT 0,
        metodo VARCHAR(30) DEFAULT 'card',
        estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (libro_id) REFERENCES biblioteca_libros(id) ON DELETE CASCADE,
        KEY idx_usuario_libro (usuario_id, libro_id),
        UNIQUE KEY uniq_charge (openpay_charge_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS biblioteca_revistas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        edicion VARCHAR(255) NOT NULL,
        fecha VARCHAR(100) NOT NULL,
        imagen VARCHAR(500) DEFAULT '/revista_cover.png',
        link_descarga VARCHAR(500) NOT NULL,
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS biblioteca_entrevistas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        experto VARCHAR(255) NOT NULL,
        cargo VARCHAR(255) NOT NULL,
        video_url VARCHAR(500) NOT NULL,
        duracion VARCHAR(100) DEFAULT '10:00 min',
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS biblioteca_investigacion (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        autor VARCHAR(255) NOT NULL,
        descripcion TEXT,
        imagen VARCHAR(500) DEFAULT '/libro_concreto.png',
        archivo_url VARCHAR(500) DEFAULT NULL,
        archivo_nombre VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS curso_biografias (
        id INT AUTO_INCREMENT PRIMARY KEY,
        curso_id INT NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        cargo VARCHAR(255) DEFAULT NULL,
        foto_url VARCHAR(500) DEFAULT NULL,
        biografia TEXT NOT NULL,
        orden INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Sembrar datos por defecto de la biblioteca si están vacías
    const [libros] = await pool.execute('SELECT id FROM biblioteca_libros LIMIT 1') as any[];
    if (libros.length === 0) {
      console.log('Sembrando libros iniciales...');
      await pool.execute(`
        INSERT INTO biblioteca_libros (titulo, autor, descripcion, precio, imagen, paginas, tienda_url)
        VALUES 
        ('Tecnología del Concreto y Cemento', 'Ing. Alejandro Morales & Dra. Elena García', 'Una guía fundamental que abarca desde la composición química del cemento Portland hasta las técnicas más avanzadas de dosificación y colocación de concreto en obras masivas.', 750.00, '/libro_concreto.png', 480, 'https://tienda.imcyc.com/products'),
        ('Control de Calidad en el Concreto', 'Ing. Carlos E. Gómez', 'Manual práctico enfocado en los ensayos de resistencia a la compresión, flexión y durabilidad del concreto, alineado con las normas técnicas mexicanas e internacionales de construcción.', 620.00, '/libro_control.png', 350, 'https://tienda.imcyc.com/products')
      `);
    }

    const [revistas] = await pool.execute('SELECT id FROM biblioteca_revistas LIMIT 1') as any[];
    if (revistas.length === 0) {
      console.log('Sembrando revistas iniciales...');
      await pool.execute(`
        INSERT INTO biblioteca_revistas (edicion, fecha, imagen, link_descarga, descripcion)
        VALUES 
        ('Edición Especial: Sostenibilidad e Innovación en Hormigón', 'Mayo 2026', '/revista_cover.png', 'https://www.imcyc.com.mx/revista', 'Reportaje central sobre arquitectura de vanguardia, tecnología 4.0 con drones y BIM, y la nueva era de estructuras de concreto inteligentes y eco-eficientes.')
      `);
    }

    const [entrevistas] = await pool.execute('SELECT id FROM biblioteca_entrevistas LIMIT 1') as any[];
    if (entrevistas.length === 0) {
      console.log('Sembrando entrevistas iniciales...');
      await pool.execute(`
        INSERT INTO biblioteca_entrevistas (titulo, experto, cargo, video_url, duracion, descripcion)
        VALUES 
        ('La Evolución del Concreto Sustentable en América Latina', 'Dr. Humberto Balandrano', 'Director de Investigación de Materiales, IMCYC', 'https://www.youtube.com/embed/F429Z5dF_vU', '18:45 min', 'Una entrevista profunda sobre la reducción de la huella de carbono en la producción del clínker y el uso de aditivos de última generación.'),
        ('Patología y Durabilidad de Estructuras de Concreto', 'M. en I. Ricardo Sánchez', 'Consultor Senior en Estructivas Masivas', 'https://www.youtube.com/embed/2_HjZkC6H7I', '24:10 min', 'Charla magistral enfocada en la prevención de la corrosión por cloruros en zonas costeras y métodos de reparación estructural.')
      `);
    }

    // 6. Tablas de grupos / cohortes y solicitudes de acceso
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS grupos_cohortes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        codigo VARCHAR(50) UNIQUE NOT NULL,
        creador_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creador_id) REFERENCES usuarios(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [tablasGrupoMaestros] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'grupo_maestros'`
    );

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS grupo_maestros (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grupo_id INT NOT NULL,
        maestro_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grupo_id) REFERENCES grupos_cohortes(id) ON DELETE CASCADE,
        FOREIGN KEY (maestro_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        UNIQUE KEY unica_grupo_maestro (grupo_id, maestro_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Migrar solo al crear la tabla: repetirlo restauraba maestros que el administrador había quitado.
    if (tablasGrupoMaestros.length === 0) {
      await pool.execute(
        `INSERT IGNORE INTO grupo_maestros (grupo_id, maestro_id)
         SELECT id, creador_id FROM grupos_cohortes WHERE creador_id IS NOT NULL`
      );
    }

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS curso_grupos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        curso_id INT NOT NULL,
        grupo_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
        FOREIGN KEY (grupo_id) REFERENCES grupos_cohortes(id) ON DELETE CASCADE,
        UNIQUE KEY unica_asignacion (curso_id, grupo_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS curso_estudiantes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        curso_id INT NOT NULL,
        estudiante_id INT NOT NULL,
        inscrito_por_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
        FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (inscrito_por_id) REFERENCES usuarios(id) ON DELETE SET NULL,
        UNIQUE KEY unica_inscripcion (curso_id, estudiante_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      await addColumnSafely('codigo', `ALTER TABLE cursos ADD COLUMN codigo VARCHAR(50) UNIQUE DEFAULT NULL`);
      await addColumnSafely('color', `ALTER TABLE cursos ADD COLUMN color VARCHAR(30) DEFAULT NULL`);
      await addColumnSafely('color_lecturas', `ALTER TABLE cursos ADD COLUMN color_lecturas VARCHAR(30) DEFAULT NULL`);
    } catch {
      /* ponytail: addColumnSafely already swallows dup column */
    }

    const { backfillCourseCodes } = await import('@/lib/codigos');
    await backfillCourseCodes();

    const { migrateCursoDirecto } = await import('@/lib/migrateCursoDirecto');
    await migrateCursoDirecto(addColumnSafely);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS solicitudes_acceso_grupo (
        id INT AUTO_INCREMENT PRIMARY KEY,
        estudiante_id INT NOT NULL,
        grupo_id INT NOT NULL,
        estado VARCHAR(50) DEFAULT 'pendiente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (grupo_id) REFERENCES grupos_cohortes(id) ON DELETE CASCADE,
        UNIQUE KEY unica_solicitud (estudiante_id, grupo_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS logs_accesos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        fecha_acceso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45) DEFAULT NULL,
        user_agent VARCHAR(255) DEFAULT NULL,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Crear tablas de notificaciones y mensajes si no existen
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        mensaje TEXT NOT NULL,
        leida BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS mensajes_maestros (
        id INT AUTO_INCREMENT PRIMARY KEY,
        estudiante_id INT NOT NULL,
        maestro_id INT NOT NULL,
        asunto VARCHAR(255) NOT NULL,
        mensaje TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (estudiante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (maestro_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Crear tabla de eventos de calendario si no existe
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS calendario_eventos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grupo_id INT NOT NULL,
        creador_id INT NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        descripcion TEXT,
        fecha_hora DATETIME NOT NULL,
        enlace_clase VARCHAR(500) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (grupo_id) REFERENCES grupos_cohortes(id) ON DELETE CASCADE,
        FOREIGN KEY (creador_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS asistencias_clases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        evento_id INT NOT NULL,
        usuario_id INT NOT NULL,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (evento_id) REFERENCES calendario_eventos(id) ON DELETE CASCADE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        UNIQUE KEY unica_asistencia (evento_id, usuario_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ponytail: alumnos con grupo_cohorte sin fila en grupos_cohortes → crear grupo automáticamente
    try {
      const { syncGruposFromAlumnos } = await import('@/lib/grupos');
      const creados = await syncGruposFromAlumnos();
      if (creados.length > 0) {
        console.log(`Grupos sincronizados desde alumnos: ${creados.join(', ')}`);
      }
    } catch (err) {
      console.error('Error al sincronizar grupos de alumnos:', err);
    }

    // 8. Sembrar notificaciones iniciales para el estudiante de prueba
    const [notifs] = await pool.execute('SELECT id FROM notificaciones LIMIT 1') as any[];
    if (notifs.length === 0) {
      console.log('Sembrando notificaciones iniciales...');
      const [estudianteUser] = await pool.execute('SELECT id FROM usuarios WHERE email = ?', ['estudiante@imcyc.com']) as any[];
      if (estudianteUser && estudianteUser.length > 0) {
        const studentId = estudianteUser[0].id;
        await pool.execute(`
          INSERT INTO notificaciones (usuario_id, titulo, mensaje)
          VALUES 
          (?, 'Bienvenido a la Academia IMCYC', 'Explora tus cursos activos y utiliza el Asistente de IA para cualquier consulta técnica.'),
          (?, 'Nueva Calificación Registrada', 'Tu entrega del módulo de Tecnología del Concreto ha sido evaluada. Calificación: 92/100.'),
          (?, 'Examen Disponible en Módulo 1', 'Ya puedes realizar la evaluación del Módulo 1 sobre Materiales.')
        `, [studentId, studentId, studentId]);
      }
    }
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
  }
}

// Inicializar base de datos de manera asíncrona al cargar el módulo en el servidor
if (typeof window === 'undefined') {
  initDb().catch(err => {
    console.error('Error al inicializar la base de datos automáticamente:', err);
  });
}
