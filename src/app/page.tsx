'use client';

import { useState, useEffect } from 'react';
import PasswordInput from '@/components/PasswordInput';
import { toAssetUrl } from '@/lib/assetUrl';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  BookOpen, 
  GraduationCap, 
  Users, 
  CheckCircle, 
  ArrowRight, 
  Send, 
  BrainCircuit,
  X,
  Sparkles
} from 'lucide-react';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Formulario de Contacto
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactProgram, setContactProgram] = useState('Maestría en Tecnología del Concreto');
  const [contactMessage, setContactMessage] = useState('');
  const [isContactSuccess, setIsContactSuccess] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (!isLoginModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isLoginModalOpen]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          'No se pudo iniciar sesión. Intenta de nuevo en unos momentos.'
        );
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Algo salió mal');
      }

      // Redirigir según el rol del usuario
      if (data.user.role === 'administrador') {
        router.push('/admin');
      } else if (data.user.role === 'maestro') {
        router.push('/maestro');
      } else {
        router.push('/estudiante');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactLoading(true);
    // Simular envío de datos
    setTimeout(() => {
      setContactLoading(false);
      setIsContactSuccess(true);
    }, 1200);
  };

  const closeContactSuccess = () => {
    setIsContactSuccess(false);
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setContactMessage('');
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div style={styles.landingContainer}>
      {/* 1. Header institucional */}
      <header className="landing-header" style={styles.header}>
        <div style={styles.headerLeft}>
          <Image
            src="https://imcyc.com.mx/logo-imcyc.svg"
            alt="Logo IMCYC"
            width={120}
            height={36}
            style={{ objectFit: 'contain' }}
          />
          <div style={styles.brandDivider}></div>
          <div style={styles.brandTitle}>
            <span style={styles.brandMain}>DIPLOMADO</span>
            <span style={styles.brandSub}>IMCYC</span>
          </div>
        </div>
        <nav className="landing-nav" style={styles.nav}>
          <button onClick={() => scrollToSection('nosotros')} style={styles.navLink}>Nosotros</button>
          <button onClick={() => scrollToSection('maestros')} style={styles.navLink}>Maestros</button>
          <button onClick={() => scrollToSection('revista')} style={styles.navLink}>Revista y Libros</button>
          <button onClick={() => scrollToSection('contacto')} style={styles.navLink}>Solicitar Info</button>
          <button 
            onClick={() => setIsLoginModalOpen(true)} 
            style={styles.loginBtnHeader}
          >
            Iniciar Sesión
          </button>
        </nav>
      </header>

      {/* 2. Hero Section */}
      <section style={styles.heroSection}>
        <div style={styles.heroOverlayGrid1}></div>
        <div style={styles.heroOverlayGrid2}></div>
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>
            <Sparkles size={14} color="#0073A5" />
            <span>Diplomados de Excelencia Académica en Cemento y Concreto</span>
          </div>
          <h1 style={styles.heroTitle}>
            Eleva tu Nivel Profesional con el <span style={{ color: '#0073A5' }}>Diplomado IMCYC</span>
          </h1>
          <p style={styles.heroSubtitle}>
            Impartimos maestrías y diplomados altamente especializados sobre el diseño, control de calidad, patología y durabilidad del concreto, avalados por el organismo técnico líder en México.
          </p>
          <div style={styles.heroActions}>
            <button 
              onClick={() => scrollToSection('contacto')} 
              style={styles.heroBtnPrimary}
            >
              Solicitar Más Información <ArrowRight size={18} />
            </button>
            <button 
              onClick={() => setIsLoginModalOpen(true)} 
              style={styles.heroBtnSecondary}
            >
              Ingresar a la Plataforma
            </button>
          </div>
        </div>
      </section>

      {/* 3. Pillars / Beneficios */}
      <section style={styles.sectionContainer} id="nosotros">
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTag}>¿Por qué el Diplomado IMCYC?</span>
          <h2 style={styles.sectionTitle}>La Máxima Autoridad del Concreto a tu Alcance</h2>
          <p style={styles.sectionSubtitle}>Ofrecemos un entorno educativo único diseñado por ingenieros y expertos con décadas de experiencia en obras masivas e investigación.</p>
        </div>

        <div className="grid-3" style={{ gap: '24px', marginTop: '40px' }}>
          <div className="card" style={styles.pillarCard}>
            <div style={{ ...styles.pillarIconWrapper, backgroundColor: 'rgba(0,115,165,0.08)', color: '#0073A5' }}>
              <GraduationCap size={24} />
            </div>
            <h3 style={styles.pillarTitle}>Maestrías Profesionales</h3>
            <p style={styles.pillarDesc}>Programas curriculares que abarcan desde aditivos químicos avanzados hasta el diseño sismo-resistente y patologías del concreto.</p>
          </div>

          <div className="card" style={styles.pillarCard}>
            <div style={{ ...styles.pillarIconWrapper, backgroundColor: 'rgba(16,185,129,0.08)', color: 'var(--success)' }}>
              <BrainCircuit size={24} />
            </div>
            <h3 style={styles.pillarTitle}>Asistente Académico con IA</h3>
            <p style={styles.pillarDesc}>Una herramienta inteligente disponible 24/7 para que los alumnos resuelvan dudas teóricas basadas directamente en normativas del IMCYC.</p>
          </div>

          <div className="card" style={styles.pillarCard}>
            <div style={{ ...styles.pillarIconWrapper, backgroundColor: 'rgba(245,158,11,0.08)', color: 'var(--warning)' }}>
              <BookOpen size={24} />
            </div>
            <h3 style={styles.pillarTitle}>Biblioteca y Valor Agregado</h3>
            <p style={styles.pillarDesc}>Lectura digital de la Revista de Construcción y Tecnología, catálogos de libros técnicos y entrevistas en video con líderes mundiales.</p>
          </div>
        </div>
      </section>

      {/* 4. Nuestros Maestros */}
      <section style={{ ...styles.sectionContainer, backgroundColor: '#F8FAFC' }} id="maestros">
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTag}>Cuerpo Docente</span>
          <h2 style={styles.sectionTitle}>Aprende de Expertos de Rango Internacional</h2>
          <p style={styles.sectionSubtitle}>Nuestro comité y profesores son líderes activos en la formulación de normas mexicanas de construcción e investigación de nuevos cementantes.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', marginTop: '40px' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '32px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(0,115,165,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={28} color="#0073A5" />
              </div>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Dr. Roberto Uribe Afif</h3>
                <span style={{ fontSize: '12px', color: '#0073A5', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Director General del IMCYC</span>
              </div>
            </div>
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>• <strong>Ing. Geólogo</strong> egresado de la UNAM.</li>
              <li style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>• <strong>M. en I.</strong> con especialidad en exploración de recursos energéticos del subsuelo (UNAM).</li>
              <li style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>• <strong>Dr. Honoris Causa</strong> por la Universidad Simón Bolívar.</li>
              <li style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>• <strong>CFE:</strong> Ingeniero de proyecto durante 8 años.</li>
              <li style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>• <strong>CEMEX México:</strong> Director técnico para México y Latinoamérica.</li>
              <li style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>• <strong>IMCYC:</strong> Director General del Instituto Mexicano del Cemento y del Concreto, A.C.</li>
              <li style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>• <strong>Certificación CONOCER:</strong> Diseño e Impartición de Cursos (EC-0217 / EC-0301).</li>
            </ul>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '32px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(0,115,165,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={28} color="#0073A5" />
              </div>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Arq. José Antonio del Rosal</h3>
                <span style={{ fontSize: '12px', color: '#0073A5', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Especialista y Evaluador ACI</span>
              </div>
            </div>
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>• <strong>Arquitecto</strong> egresado de la Universidad Tecnológica de México.</li>
              <li style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>• <strong>Maestría:</strong> Dirección de proyectos en la división de estudios de posgrado (UNITEC, 2010-2012).</li>
              <li style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>
                • <strong>Certificado por el ACI (American Concrete Institute) como:</strong>
                <ul style={{ listStyleType: 'circle', paddingLeft: '20px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li style={{ fontSize: '12px', color: '#64748B' }}>Técnico y acabador de superficies planas de concreto.</li>
                  <li style={{ fontSize: '12px', color: '#64748B' }}>Técnico para pruebas al concreto en la obra. Grado I.</li>
                  <li style={{ fontSize: '12px', color: '#64748B' }}>Técnico laboratorista nivel 1 y nivel 2.</li>
                  <li style={{ fontSize: '12px', color: '#64748B' }}>Supervisor especializado en obras de concreto.</li>
                </ul>
              </li>
              <li style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>• <strong>Certificación CONOCER:</strong> Diseño e Impartición de Cursos (EC-0217 / EC-0301).</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5. Revista y Biblioteca Showcase */}
      <section style={styles.sectionContainer} id="revista">
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTag}>Revistas y Libros Oficiales</span>
          <h2 style={styles.sectionTitle}>Biblioteca del Concreto y Tecnología</h2>
          <p style={styles.sectionSubtitle}>Los alumnos suscritos tienen acceso directo para leer y descargar estas publicaciones líderes de la industria.</p>
        </div>

        <div style={styles.showcaseWrapper}>
          <div style={styles.showcaseItem}>
            <div style={styles.showcaseImgWrapper}>
              <img src="/revista_cover.png" alt="Revista IMCYC" style={styles.showcaseImg} />
            </div>
            <div style={styles.showcaseInfo}>
              <span style={styles.showcaseBadge}>Última Edición</span>
              <h3 style={styles.showcaseTitle}>Revista Construcción y Tecnología</h3>
              <p style={styles.showcaseDesc}>Reportajes centrales de BIM 4.0, escaneo láser con drones en obras viales y las nuevas metodologías de colocación de concreto en climas desérticos.</p>
              <button onClick={() => setIsLoginModalOpen(true)} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}>
                Acceder para Leer <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div style={styles.showcaseItem}>
            <div style={styles.showcaseImgWrapper}>
              <img src={toAssetUrl('/libro_concreto.png')} alt="Libro Concreto" style={styles.showcaseImg} />
            </div>
            <div style={styles.showcaseInfo}>
              <span style={styles.showcaseBadge}>Literatura Científica</span>
              <h3 style={styles.showcaseTitle}>Tecnología del Concreto y Cemento</h3>
              <p style={styles.showcaseDesc}>La obra cumbre en dosificación de mezclas del instituto, abarcando desde cementos adicionados hasta el curado químico moderno para concreto de alto desempeño.</p>
              <a href="https://tienda.imcyc.com/products" target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}>
                Ver en Tienda Oficial <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Formulario Contacto */}
      <section style={{ ...styles.sectionContainer, backgroundColor: '#0F172A', color: '#FFFFFF' }} id="contacto">
        <div style={{ ...styles.sectionHeader, color: '#FFFFFF' }}>
          <span style={{ ...styles.sectionTag, backgroundColor: 'rgba(0,115,165,0.15)', color: '#0073A5' }}>Admisiones 2026</span>
          <h2 style={{ ...styles.sectionTitle, color: '#FFFFFF' }}>Solicita Información y Da el Siguiente Paso</h2>
          <p style={{ ...styles.sectionSubtitle, color: '#94A3B8' }}>Déjanos tus datos. Un asesor académico se pondrá en contacto contigo para detallar los planes de estudio, costos y fechas de inicio.</p>
        </div>

        <div style={styles.contactLayout}>
          <div style={styles.contactDetails}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0073A5', marginBottom: '16px' }}>Beneficios de Estudiar con Nosotros</h3>
            <ul style={styles.benefitList}>
              <li style={styles.benefitItem}><CheckCircle size={16} color="#0073A5" /> Título y Cédula Profesional Oficial.</li>
              <li style={styles.benefitItem}><CheckCircle size={16} color="#0073A5" /> Plataforma de clases disponible 24 horas.</li>
              <li style={styles.benefitItem}><CheckCircle size={16} color="#0073A5" /> Asistencia de Inteligencia Artificial para trabajos de titulación.</li>
              <li style={styles.benefitItem}><CheckCircle size={16} color="#0073A5" /> Descuentos de hasta el 30% en libros técnicos y laboratorios.</li>
              <li style={styles.benefitItem}><CheckCircle size={16} color="#0073A5" /> Red de contactos con constructores líderes de Latinoamérica.</li>
            </ul>
          </div>

          <div style={styles.contactFormWrapper}>
            <form onSubmit={handleContactSubmit} style={styles.contactForm}>
              <div className="form-group">
                <label className="form-label" style={{ color: '#E2E8F0' }}>Nombre Completo</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={styles.darkInput}
                  value={contactName} 
                  onChange={(e) => setContactName(e.target.value)} 
                  placeholder="Ej. Ing. Carlos Martínez"
                  required 
                />
              </div>

              <div className="grid-2" style={{ gap: '16px', marginBottom: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ color: '#E2E8F0' }}>Correo Electrónico</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    style={styles.darkInput}
                    value={contactEmail} 
                    onChange={(e) => setContactEmail(e.target.value)} 
                    placeholder="carlos.martinez@ejemplo.com"
                    required 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ color: '#E2E8F0' }}>Teléfono de Contacto</label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    style={styles.darkInput}
                    value={contactPhone} 
                    onChange={(e) => setContactPhone(e.target.value)} 
                    placeholder="5512345678"
                    required 
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label" style={{ color: '#E2E8F0' }}>Programa de Interés</label>
                <select 
                  className="form-select" 
                  style={styles.darkInput}
                  value={contactProgram} 
                  onChange={(e) => setContactProgram(e.target.value)}
                >
                  <option value="Maestría en Tecnología del Concreto">Maestría en Tecnología del Concreto</option>
                  <option value="Maestría en Patología Estructural">Maestría en Patología Estructural</option>
                  <option value="Diplomado en Ensayos de Calidad y Laboratorios">Diplomado en Ensayos de Calidad y Laboratorios</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: '#E2E8F0' }}>¿Tienes alguna duda o requerimiento especial?</label>
                <textarea 
                  className="form-input" 
                  style={{ ...styles.darkInput, minHeight: '80px', resize: 'vertical' }}
                  value={contactMessage} 
                  onChange={(e) => setContactMessage(e.target.value)} 
                  placeholder="Escribe tu mensaje aquí..."
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
                disabled={contactLoading}
              >
                {contactLoading ? 'Enviando...' : (
                  <>Solicitar Información <Send size={16} /></>
                )}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <Image
                src="https://imcyc.com.mx/logo-imcyc.svg"
                alt="Logo"
                width={100}
                height={30}
                style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
              />
              <span style={{ fontWeight: '800', color: '#FFFFFF', fontSize: '14px' }}>DIPLOMADO IMCYC</span>
            </div>
            <p style={{ color: '#64748B', fontSize: '13px', maxWidth: '300px' }}>Plataforma LMS e Institucional para la alta formación en tecnología del cemento y concreto.</p>
          </div>
          <div>
            <h4 style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Enlaces</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <button onClick={() => scrollToSection('nosotros')} style={styles.footerLink}>Nosotros</button>
              <button onClick={() => scrollToSection('maestros')} style={styles.footerLink}>Maestros</button>
              <button onClick={() => scrollToSection('revista')} style={styles.footerLink}>Revista Oficial</button>
            </div>
          </div>
          <div>
            <h4 style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>Contacto</h4>
            <p style={{ color: '#64748B', fontSize: '13px', lineHeight: '1.5' }}>
              Av. Insurgentes Sur 1846, Col. Florida<br />
              Ciudad de México, C.P. 01030<br />
              Email: cursos@imcyc.com<br />
              Teléfono: (55) 53 22 57 40 Ext. 210
            </p>
          </div>
        </div>
        <div style={styles.footerBottom}>
          <p>© 2026 Instituto Mexicano del Cemento y del Concreto A.C. Todos los derechos reservados.</p>
        </div>
      </footer>

      {/* 8. MODAL DE LOGIN (Ingresar a la plataforma) */}
      {isLoginModalOpen && (
        <div style={styles.modalOverlay} onClick={(event) => { if (event.target === event.currentTarget) setIsLoginModalOpen(false); }} onKeyDown={(event) => {
          if (event.key === 'Escape') { setIsLoginModalOpen(false); setError(''); }
          if (event.key !== 'Tab') return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'));
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
          <div className="card" role="dialog" aria-modal="true" aria-labelledby="login-title" style={styles.loginModal} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => {
                setIsLoginModalOpen(false);
                setError('');
              }} 
              style={styles.modalCloseBtn}
              aria-label="Cerrar inicio de sesión"
            >
              <X size={20} />
            </button>

            <div style={styles.loginLogoContainer}>
              <Image
                src="https://imcyc.com.mx/logo-imcyc.svg"
                alt="Logo IMCYC"
                width={150}
                height={45}
                style={{ objectFit: 'contain', margin: '0 auto 12px auto' }}
              />
              <h2 id="login-title" style={styles.loginTitle}>Ingresar al Diplomado</h2>
              <p style={styles.loginSubtitle}>Ingresa tus credenciales para acceder a tus materias.</p>
            </div>

            {error && <div role="alert" style={styles.errorAlert}>{error}</div>}

            <form onSubmit={handleLogin} style={styles.loginForm}>
              <div className="form-group">
                <label className="form-label" htmlFor="modal-email">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  id="modal-email"
                  autoComplete="username"
                  autoFocus
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@imcyc.com"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" htmlFor="modal-password">
                  Contraseña
                </label>
                <PasswordInput
                  id="modal-password"
                  autoComplete="current-password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                disabled={loading}
              >
                {loading ? 'Iniciando Sesión...' : 'Ingresar al Diplomado'}
              </button>
            </form>

          </div>
        </div>
      )}

      {/* 9. MODAL DE SOLICITUD DE INFORMACIÓN EXITOSA */}
      {isContactSuccess && (
        <div style={styles.modalOverlay}>
          <div className="card" style={{ ...styles.loginModal, textAlign: 'center', padding: '40px 32px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <CheckCircle size={32} />
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#0073A5', marginBottom: '12px' }}>¡Solicitud Recibida!</h3>
            <p style={{ fontSize: '14px', color: '#64748B', lineHeight: '1.5', marginBottom: '24px' }}>
              Hola <strong>{contactName}</strong>, hemos registrado tu interés en el programa <strong>{contactProgram}</strong>. Uno de nuestros asesores de admisiones te enviará el folleto completo y costos al correo <strong>{contactEmail}</strong> a la brevedad.
            </p>
            <button onClick={closeContactSuccess} className="btn btn-primary" style={{ width: '200px', margin: '0 auto' }}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  landingContainer: {
    backgroundColor: '#FFFFFF',
    fontFamily: 'var(--font-sans)',
    color: 'var(--text-primary)',
    minHeight: '100vh',
  },
  header: {
    height: '70px',
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 40px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 4px 10px rgba(0, 115, 165, 0.02)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  brandDivider: {
    width: '1px',
    height: '24px',
    backgroundColor: 'var(--border)',
  },
  brandTitle: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: '1.1',
  },
  brandMain: {
    fontSize: '14px',
    fontWeight: '800',
    color: '#0073A5',
    letterSpacing: '0.05em',
  },
  brandSub: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#B0B3B5',
    letterSpacing: '0.1em',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  navLink: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    color: '#64748B',
    cursor: 'pointer',
    transition: 'var(--transition)',
    outline: 'none',
  },
  loginBtnHeader: {
    backgroundColor: 'rgba(0, 115, 165, 0.08)',
    color: '#0073A5',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  heroSection: {
    position: 'relative',
    padding: '100px 40px',
    textAlign: 'center',
    background: 'radial-gradient(circle at 10% 20%, rgba(0, 115, 165, 0.06) 0%, rgba(244, 247, 249, 0.95) 90%)',
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'center',
  },
  heroOverlayGrid1: {
    position: 'absolute',
    top: '-150px',
    right: '-100px',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,115,165,0.04) 0%, rgba(0,0,0,0) 70%)',
  },
  heroOverlayGrid2: {
    position: 'absolute',
    bottom: '-150px',
    left: '-150px',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(176,179,181,0.08) 0%, rgba(0,0,0,0) 70%)',
  },
  heroContent: {
    maxWidth: '800px',
    zIndex: 2,
    position: 'relative',
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(0, 115, 165, 0.06)',
    border: '1px solid rgba(0, 115, 165, 0.1)',
    borderRadius: '20px',
    padding: '6px 16px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#0073A5',
    marginBottom: '24px',
  },
  heroTitle: {
    fontSize: '44px',
    fontWeight: '800',
    lineHeight: '1.2',
    color: '#0F172A',
    marginBottom: '20px',
    fontFamily: 'var(--font-heading)',
  },
  heroSubtitle: {
    fontSize: '16px',
    color: '#64748B',
    lineHeight: '1.6',
    marginBottom: '36px',
  },
  heroActions: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
  },
  heroBtnPrimary: {
    backgroundColor: '#0073A5',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    padding: '14px 24px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 4px 14px rgba(0, 115, 165, 0.25)',
    transition: 'var(--transition)',
  },
  heroBtnSecondary: {
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '14px 24px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  sectionContainer: {
    padding: '80px 40px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  sectionHeader: {
    textAlign: 'center',
    maxWidth: '700px',
    margin: '0 auto 48px auto',
  },
  sectionTag: {
    fontSize: '12px',
    fontWeight: '800',
    color: '#0073A5',
    backgroundColor: 'rgba(0,115,165,0.06)',
    padding: '4px 12px',
    borderRadius: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  sectionTitle: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#0F172A',
    marginTop: '12px',
    marginBottom: '12px',
    fontFamily: 'var(--font-heading)',
  },
  sectionSubtitle: {
    fontSize: '14px',
    color: '#64748B',
    lineHeight: '1.5',
  },
  pillarCard: {
    padding: '32px',
    backgroundColor: '#FFFFFF',
    transition: 'var(--transition)',
  },
  pillarIconWrapper: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  pillarTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: '12px',
  },
  pillarDesc: {
    fontSize: '13px',
    color: '#64748B',
    lineHeight: '1.5',
  },
  teacherCard: {
    padding: '28px',
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
  },
  teacherAvatar: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0,115,165,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px auto',
  },
  teacherName: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: '4px',
  },
  teacherRole: {
    fontSize: '12px',
    color: '#0073A5',
    fontWeight: '700',
    display: 'block',
    marginBottom: '12px',
  },
  teacherBio: {
    fontSize: '12px',
    color: '#64748B',
    lineHeight: '1.5',
  },
  showcaseWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
    marginTop: '40px',
  },
  showcaseItem: {
    display: 'flex',
    gap: '32px',
    padding: '32px',
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    alignItems: 'center',
  },
  showcaseImgWrapper: {
    width: '120px',
    height: '160px',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
    flexShrink: 0,
    backgroundColor: '#F1F5F9',
  },
  showcaseImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  showcaseInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  showcaseBadge: {
    alignSelf: 'flex-start',
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748B',
    backgroundColor: 'rgba(176,179,181,0.15)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  showcaseTitle: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#0F172A',
  },
  showcaseDesc: {
    fontSize: '14px',
    color: '#64748B',
    lineHeight: '1.5',
    marginBottom: '8px',
  },
  contactLayout: {
    display: 'grid',
    gridTemplateColumns: '5fr 7fr',
    gap: '40px',
    alignItems: 'center',
  },
  contactDetails: {
    padding: '20px 0',
  },
  benefitList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginTop: '24px',
  },
  benefitItem: {
    fontSize: '14px',
    color: '#94A3B8',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  contactFormWrapper: {
    backgroundColor: '#1E293B',
    borderRadius: '16px',
    padding: '32px',
    border: '1px solid #334155',
  },
  contactForm: {
    width: '100%',
  },
  darkInput: {
    backgroundColor: '#0F172A',
    border: '1px solid #334155',
    color: '#FFFFFF',
  },
  footer: {
    backgroundColor: '#0F172A',
    borderTop: '1px solid #1E293B',
    padding: '60px 40px 20px 40px',
  },
  footerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '40px',
    paddingBottom: '40px',
    borderBottom: '1px solid #1E293B',
  },
  footerLink: {
    background: 'none',
    border: 'none',
    color: '#64748B',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '0',
    transition: 'var(--transition)',
  },
  footerBottom: {
    maxWidth: '1200px',
    margin: '20px auto 0 auto',
    textAlign: 'center',
    color: '#475569',
    fontSize: '12px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  loginModal: {
    width: '90%',
    maxWidth: '440px',
    padding: '32px',
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#64748B',
  },
  modalCloseBtnText: {
    fontSize: '0px',
  },
  loginLogoContainer: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  loginTitle: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#0073A5',
    marginBottom: '4px',
  },
  loginSubtitle: {
    fontSize: '12px',
    color: '#64748B',
  },
  loginForm: {
    width: '100%',
  },
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    color: '#EF4444',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    marginBottom: '16px',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    textAlign: 'center',
  },
};
