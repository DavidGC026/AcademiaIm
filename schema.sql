-- Schema inicial de MySQL para Academia IMCYC (LMS)

-- 1. Tabla de Roles
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    foto_perfil VARCHAR(500) DEFAULT NULL,
    grupo_cohorte VARCHAR(100) DEFAULT NULL,
    acceso_biblioteca_prioritario TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla de Cursos (con estado de aprobación por el Administrador)
CREATE TABLE IF NOT EXISTS cursos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    codigo VARCHAR(50) UNIQUE DEFAULT NULL,
    imagen VARCHAR(500) DEFAULT NULL,
    creado_por_id INT NOT NULL,
    estado VARCHAR(50) DEFAULT 'pendiente', -- 'pendiente', 'aprobado', 'rechazado'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creado_por_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabla de Clases (cuelgan directamente de la materia/curso)
CREATE TABLE IF NOT EXISTS clases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    curso_id INT NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    video_url VARCHAR(500) DEFAULT NULL,
    videos JSON DEFAULT NULL,
    clase_en_vivo_url VARCHAR(500) DEFAULT NULL,
    materiales JSON DEFAULT NULL,
    requiere_tarea TINYINT(1) DEFAULT 0,
    tarea_descripcion TEXT DEFAULT NULL,
    tarea_recurso_nombre VARCHAR(255) DEFAULT NULL,
    tarea_recurso_url VARCHAR(500) DEFAULT NULL,
    tarea_recursos JSON DEFAULT NULL,
    referencias JSON DEFAULT NULL,
    orden INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabla de Entregas de Tareas
CREATE TABLE IF NOT EXISTS entregas_tareas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clase_id INT NOT NULL,
    usuario_id INT NOT NULL,
    archivo_nombre VARCHAR(255) NOT NULL,
    archivo_url VARCHAR(500) NOT NULL,
    estado VARCHAR(50) DEFAULT 'entregado', -- 'entregado', 'calificado'
    fecha_entrega TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    calificacion DECIMAL(5,2) DEFAULT NULL,
    comentarios TEXT DEFAULT NULL,
    permite_reenvio TINYINT(1) DEFAULT 0,
    FOREIGN KEY (clase_id) REFERENCES clases(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE KEY unica_entrega (clase_id, usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabla de Foro Posts (Hilos de discusión y respuestas)
CREATE TABLE IF NOT EXISTS foro_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    curso_id INT NOT NULL,
    usuario_id INT NOT NULL,
    post_padre_id INT DEFAULT NULL,
    contenido TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (post_padre_id) REFERENCES foro_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tabla de Logs de Acceso (para módulo de analíticas)
CREATE TABLE IF NOT EXISTS logs_accesos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    fecha_acceso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent VARCHAR(255) DEFAULT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Tabla de Configuración de Sistema (incluye API Keys y Proveedores de IA)
CREATE TABLE IF NOT EXISTS configuracion (
    clave VARCHAR(100) PRIMARY KEY, -- Ej: 'ia_provider', 'ia_api_key'
    valor TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar Roles
INSERT INTO roles (id, nombre) VALUES (1, 'administrador') ON DUPLICATE KEY UPDATE nombre=nombre;
INSERT INTO roles (id, nombre) VALUES (2, 'maestro') ON DUPLICATE KEY UPDATE nombre=nombre;
INSERT INTO roles (id, nombre) VALUES (3, 'estudiante') ON DUPLICATE KEY UPDATE nombre=nombre;

-- Insertar configuración por defecto para el proveedor de IA (simulado por defecto)
INSERT INTO configuracion (clave, valor) VALUES ('ia_provider', 'gemini') ON DUPLICATE KEY UPDATE valor=valor;
INSERT INTO configuracion (clave, valor) VALUES ('ia_api_key', 'mock_api_key') ON DUPLICATE KEY UPDATE valor=valor;

-- 10. Tabla de Exámenes
CREATE TABLE IF NOT EXISTS examenes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    curso_id INT NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    limite_tiempo INT DEFAULT 0,
    modo_liberacion VARCHAR(32) NOT NULL DEFAULT 'abierto',
    clase_requisito_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Tabla de Preguntas de Examen
CREATE TABLE IF NOT EXISTS preguntas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    examen_id INT NOT NULL,
    pregunta TEXT NOT NULL,
    tipo VARCHAR(50) DEFAULT 'opcion_multiple',
    FOREIGN KEY (examen_id) REFERENCES examenes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Tabla de Opciones de Pregunta
CREATE TABLE IF NOT EXISTS opciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pregunta_id INT NOT NULL,
    texto TEXT NOT NULL,
    es_correcta BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (pregunta_id) REFERENCES preguntas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Tabla de Intentos de Exámenes por Estudiantes
CREATE TABLE IF NOT EXISTS intentos_examenes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    examen_id INT NOT NULL,
    usuario_id INT NOT NULL,
    calificacion DECIMAL(5,2) DEFAULT NULL,
    iniciado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finalizado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    permite_reintento TINYINT(1) NOT NULL DEFAULT 0,
    respuestas JSON DEFAULT NULL,
    historial JSON DEFAULT NULL,
    FOREIGN KEY (examen_id) REFERENCES examenes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE KEY unica_intento (examen_id, usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Tabla de Libros de Biblioteca
CREATE TABLE IF NOT EXISTS biblioteca_libros (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    autor VARCHAR(255) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    imagen VARCHAR(500) DEFAULT '/libro_concreto.png',
    paginas INT DEFAULT 0,
    tienda_url VARCHAR(500) DEFAULT 'https://tienda.imcyc.com/products',
    archivo_url VARCHAR(500) DEFAULT NULL,
    archivo_nombre VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14b. Compras de libros (pago en plataforma vía Openpay)
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

-- 15. Tabla de Revistas de Biblioteca
CREATE TABLE IF NOT EXISTS biblioteca_revistas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    edicion VARCHAR(255) NOT NULL,
    fecha VARCHAR(100) NOT NULL,
    imagen VARCHAR(500) DEFAULT '/revista_cover.png',
    link_descarga VARCHAR(500) NOT NULL,
    archivo_url VARCHAR(500) DEFAULT NULL,
    archivo_nombre VARCHAR(255) DEFAULT NULL,
    revista_del_mes TINYINT(1) DEFAULT 0,
    mes_destacado VARCHAR(100) DEFAULT NULL,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Tabla de Entrevistas de Biblioteca
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

-- 17. Tabla de Notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT NOT NULL,
    leida BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. Tabla de Mensajes a Maestros
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

-- 18b. Tabla de Grupos y Cohortes
CREATE TABLE IF NOT EXISTS grupos_cohortes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    creador_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creador_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Maestros asignados a un grupo (N maestros por grupo)
CREATE TABLE IF NOT EXISTS grupo_maestros (
    id INT AUTO_INCREMENT PRIMARY KEY,
    grupo_id INT NOT NULL,
    maestro_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (grupo_id) REFERENCES grupos_cohortes(id) ON DELETE CASCADE,
    FOREIGN KEY (maestro_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE KEY unica_grupo_maestro (grupo_id, maestro_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18c. Tabla de Inscripción directa de estudiantes a cursos
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

-- 18d. Tabla de Cursos por Grupo
CREATE TABLE IF NOT EXISTS curso_grupos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    curso_id INT NOT NULL,
    grupo_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
    FOREIGN KEY (grupo_id) REFERENCES grupos_cohortes(id) ON DELETE CASCADE,
    UNIQUE KEY unica_asignacion (curso_id, grupo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18e. Tabla de Solicitudes de Acceso a Grupo
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


-- 19. Tabla de Eventos de Calendario
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

-- 20. Tabla de Asistencias a Clases en Vivo
CREATE TABLE IF NOT EXISTS asistencias_clases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evento_id INT NOT NULL,
    usuario_id INT NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evento_id) REFERENCES calendario_eventos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE KEY unica_asistencia (evento_id, usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

