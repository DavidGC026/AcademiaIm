'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  GraduationCap,
  Layers,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  Menu,
  Target,
  Users,
  X,
} from 'lucide-react';
import { EMPRESAS, MODELOS_INNOVACION } from '@/lib/innovacion-data';
import AreasDominio from '@/components/AreasDominio';
import EcosistemaHibrido from '@/components/EcosistemaHibrido';
import IndustriaAdopcion from '@/components/IndustriaAdopcion';
import styles from './page.module.css';
import { campusBranding, isInnovationCampus } from '@/lib/campusBranding';
import { campusLanding, concreteAreas } from '@/lib/campusLanding';
import { toAssetUrl } from '@/lib/assetUrl';
import Image from 'next/image';

const pillarIcons = { strategy: Target, users: Users, layers: Layers };
const navigation = [
  { id: 'enfoque', label: 'La formación' },
  { id: 'modulos', label: 'Programa' },
  { id: 'maestro', label: 'Tu instructor' },
  { id: 'ecosistema', label: isInnovationCampus ? 'Casos de estudio' : 'Recursos' },
];
const learningPath = campusLanding.paths.map(step => ({ ...step, icon: pillarIcons[step.icon] }));
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || (isInnovationCampus ? '' : 'cursos@imcyc.com');

export default function LandingPage() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const loginRequestRef = useRef<AbortController | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => () => loginRequestRef.current?.abort(), []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileNavOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileNavOpen]);

  const openLogin = () => {
    setMobileNavOpen(false);
    setError('');
    dialogRef.current?.showModal();
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const request = new AbortController();
    loginRequestRef.current = request;
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: request.signal,
      });
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error(
          'No pudimos conectar con la plataforma. Inténtalo de nuevo en unos momentos.',
        );
      }
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Revisa tu correo y contraseña e inténtalo de nuevo.');
      const destination =
        result.user.role === 'administrador'
          ? '/admin'
          : result.user.role === 'maestro'
            ? '/maestro/materias'
            : '/estudiante';
      router.push(destination);
      router.refresh();
    } catch (loginError: unknown) {
      if (request.signal.aborted) return;
      setError(
        loginError instanceof TypeError || loginError instanceof SyntaxError
          ? 'No pudimos conectar con la plataforma. Inténtalo de nuevo en unos momentos.'
          : loginError instanceof Error
            ? loginError.message
            : 'No pudimos iniciar sesión. Inténtalo de nuevo.',
      );
    } finally {
      if (loginRequestRef.current === request) {
        loginRequestRef.current = null;
        setLoading(false);
      }
    }
  };

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#contenido">
        Saltar al contenido
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="#inicio" className={styles.brand} aria-label={`${campusBranding.name}, inicio`}>
            <span className={isInnovationCampus ? styles.brandMark : styles.institutionLogo}>{isInnovationCampus ? <Lightbulb size={25} strokeWidth={1.7} /> : <Image src={toAssetUrl('/logo-imcyc.svg')} alt="IMCYC" width={102} height={50} priority />}</span>
            <span className={styles.brandText}>
              <strong>{campusBranding.name}</strong>
              <span>{campusBranding.subtitle}</span>
            </span>
          </a>
          <nav
            id="navegacion-principal"
            className={`${styles.nav} ${mobileNavOpen ? styles.navOpen : ''}`}
            aria-label="Navegación principal"
          >
            {navigation.map((item) => (
              <a key={item.id} href={`#${item.id}`} onClick={() => setMobileNavOpen(false)}>
                {item.label}
              </a>
            ))}
            <a
              className={styles.mobileHelp}
              href="#contacto"
              onClick={() => setMobileNavOpen(false)}
            >
              Preguntas frecuentes
            </a>
          </nav>
          <div className={styles.headerActions}>
            <button type="button" onClick={openLogin} className={styles.headerLogin}>
              <span>Entrar al aula</span>
              <ArrowUpRight size={17} aria-hidden="true" />
            </button>
            <button
              ref={menuButtonRef}
              type="button"
              className={styles.menuButton}
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              aria-label={mobileNavOpen ? 'Cerrar navegación' : 'Abrir navegación'}
              aria-expanded={mobileNavOpen}
              aria-controls="navegacion-principal"
            >
              {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>
      {mobileNavOpen && (
        <button
          type="button"
          className={styles.menuBackdrop}
          aria-label="Cerrar navegación"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <main id="contenido">
        <section id="inicio" className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>
                <span className={styles.eyebrowLine} /> {campusLanding.eyebrow}
              </span>
              <h1 id="hero-title">
                {campusLanding.headline}
                <br />
                {campusLanding.headlineAction}{' '}<span>{campusLanding.headlineAccent}</span>
              </h1>
              <p className={styles.heroLead}>
                {campusLanding.lead}
              </p>
              <p className={styles.heroDescription}>
                {campusLanding.description}
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primaryButton} href="#modulos">
                  Explorar el programa <ArrowRight size={18} aria-hidden="true" />
                </a>
                <button type="button" className={styles.textButton} onClick={openLogin}>
                  <BookOpen size={18} aria-hidden="true" /> Ya soy estudiante
                </button>
              </div>
              <div className={styles.heroDetails}>
                <span>
                  <Check size={15} aria-hidden="true" /> Enfoque práctico
                </span>
                <span>
                  <Check size={15} aria-hidden="true" /> {campusLanding.detail}
                </span>
                <span>
                  <Check size={15} aria-hidden="true" /> Aula virtual
                </span>
              </div>
            </div>
            <div className={styles.pathPreview}>
              <div className={styles.previewHeading}>
                <span>
                  <span className={styles.previewDot} /> {campusLanding.pathEyebrow}
                </span>
                <ArrowUpRight size={19} aria-hidden="true" />
              </div>
              <div className={styles.previewTitle}>
                {campusLanding.pathTitle}
                <br />
                <span>{campusLanding.pathAccent}</span>
              </div>
              <ol className={styles.learningPath} aria-label="Tu ruta de aprendizaje">
                {learningPath.map((step, index) => (
                  <li key={step.title}>
                    <span className={styles.pathNumber}>0{index + 1}</span>
                    <a href="#modulos" className={styles.pathCard}>
                      <span className={styles.pathIcon}>
                        <step.icon size={21} strokeWidth={1.6} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{step.title}</strong>
                        <small>{step.description}</small>
                      </span>
                      <ArrowUpRight size={16} className={styles.pathArrow} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ol>
              <div className={styles.previewFooter}>
                <span>
                  <strong>{isInnovationCampus ? MODELOS_INNOVACION.length : 'IMCYC'}</strong> {isInnovationCampus ? 'modelos de innovación' : 'formación técnica'}
                </span>
                <span className={styles.previewFooterLabel}>
                  Un enfoque conectado <Layers size={16} aria-hidden="true" />
                </span>
              </div>
            </div>
          </div>
          <div className={styles.companyStrip}>
            <p>{isInnovationCampus ? 'APRENDE DE SUS' : 'CONOCIMIENTO PARA'}<br /><strong>{isInnovationCampus ? 'MODELOS DE INNOVACIÓN' : 'LA PRÁCTICA PROFESIONAL'}</strong></p>
            <div className={styles.companyNames}>
              {isInnovationCampus ? EMPRESAS.map(company => <a href="#ecosistema" key={company.id}>{company.name}</a>) : ['Cemento', 'Concreto', 'Calidad', 'Durabilidad'].map(area => <a href="#modulos" key={area}>{area}</a>)}
            </div>
            <a href="#enfoque" className={styles.discoverLink} aria-label="Descubre el diplomado">
              <ArrowDown size={20} />
            </a>
          </div>
        </section>

        <section id="enfoque" className={styles.section} aria-labelledby="enfoque-title">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>EL ENFOQUE</span>
              <h2 id="enfoque-title">
                {campusLanding.approachTitle}<br />{campusLanding.approachAction}
              </h2>
            </div>
            <p>
              {campusLanding.approachDescription}
            </p>
          </div>
          <div className={styles.pillars}>
            {campusLanding.pillars.map((pillar) => {
              const Icon = pillarIcons[pillar.icon];
              return (
                <article key={pillar.id} className={styles.pillar}>
                  <span className={styles.pillarIcon}>
                    <Icon size={24} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <div className={styles.programSection}>
          <div className={styles.section}>
            {isInnovationCampus ? <AreasDominio /> : <section id="modulos" aria-labelledby="programa-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>LA FORMACIÓN</span><h2 id="programa-title">Del cemento al desempeño del concreto.</h2></div><p>Áreas de estudio de la Academia. Consulta con la coordinación los programas, fechas y requisitos disponibles.</p></div><div className={styles.pillars}>{concreteAreas.map(area => <article className={styles.pillar} key={area.title}><span className={styles.pillarIcon}><BookOpen size={24} aria-hidden="true" /></span><h3>{area.title}</h3><p>{area.description}</p></article>)}</div></section>}
          </div>
        </div>
        {isInnovationCampus ? <>
        <section
          className={`${styles.section} ${styles.applicationSection}`}
          aria-labelledby="aplicacion-title"
        >
          <div className={styles.applicationCopy}>
            <span className={styles.eyebrow}>INNOVACIÓN EN CONTEXTO</span>
            <h2 id="aplicacion-title">
              El método adecuado
              <br />
              para cada industria.
            </h2>
            <p>
              Cada sector tiene sus propios tiempos, riesgos y necesidades. Aprende a elegir y
              combinar las herramientas que tienen sentido para tu realidad.
            </p>
            <a className={styles.inlineLink} href="#ecosistema">
              Explora los casos de estudio <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
          <IndustriaAdopcion />
        </section>
        <div className={styles.ecosystemSection}>
          <div className={styles.section}>
            <EcosistemaHibrido />
          </div>
        </div>

        </> : <>
        <section id="ecosistema" className={`${styles.section} ${styles.applicationSection}`} aria-labelledby="recursos-title">
          <div className={styles.applicationCopy}><span className={styles.eyebrow}>RECURSOS PARA ESTUDIAR</span><h2 id="recursos-title">Una biblioteca que acompaña tu formación.</h2><p>Consulta los libros, revistas y materiales de apoyo del aula. El acceso a cada recurso depende de tu cuenta y de los permisos del programa.</p><a className={styles.inlineLink} href="https://tienda.imcyc.com/products" target="_blank" rel="noreferrer">Explorar libros IMCYC <ArrowUpRight size={17} aria-hidden="true" /></a></div>
          <div className={styles.resourcePreview}><Image src={toAssetUrl('/libro_concreto.png')} alt="Libro técnico de tecnología del concreto" width={150} height={210} /><Image src={toAssetUrl('/revista_cover.png')} alt="Revista Construcción y Tecnología en Concreto" width={150} height={210} /></div>
        </section>
        </>}

        <section
          id="maestro"
          className={`${styles.section} ${styles.instructorSection}`}
          aria-labelledby="maestro-title"
        >
          <div className={styles.instructorIdentity}>
            <span className={styles.instructorLabel}>
              <GraduationCap size={19} aria-hidden="true" /> DIRECCIÓN ACADÉMICA
            </span>
            <div className={styles.monogram} aria-hidden="true">
              RU<span>.</span>
            </div>
            <div className={styles.identityCaption}>
              <span>ING. ROBERTO URIBE AFIF</span>
              <p>
                La experiencia como
                <br />
                punto de partida.
              </p>
            </div>
          </div>
          <div className={styles.instructorCopy}>
            <span className={styles.eyebrow}>APRENDE CON EXPERIENCIA</span>
            <h2 id="maestro-title">{campusLanding.instructor.nombre}</h2>
            <p className={styles.instructorRole}>{campusLanding.instructor.titulo}</p>
            <ul>
              {campusLanding.instructor.bio.map((item) => (
                <li key={item}>
                  <Check size={18} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className={styles.instructorNote}>
              <Lightbulb size={21} strokeWidth={1.7} aria-hidden="true" />
              <p>{campusBranding.slogan}.</p>
            </div>
          </div>
        </section>

        <section
          id="contacto"
          className={`${styles.section} ${styles.faqSection}`}
          aria-labelledby="faq-title"
        >
          <div>
            <span className={styles.eyebrow}>ANTES DE COMENZAR</span>
            <h2 id="faq-title">
              Tu siguiente paso,
              <br />
              más claro.
            </h2>
            <p>Lo que necesitas saber para empezar a aprender.</p>
            {contactEmail && (
              <a
                className={styles.inlineLink}
                href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Información de ${campusBranding.name}`)}`}
              >
                Solicitar información <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            )}
            {!isInnovationCampus && <address className={styles.contactDetails}>Av. Insurgentes Sur 1846, Col. Florida<br />Ciudad de México, C.P. 01030<br /><a href="tel:+525553225740">(55) 53 22 57 40 Ext. 210</a></address>}
          </div>
          <div className={styles.faqList}>
            <details name="preguntas-diplomado">
              <summary>
                ¿Qué voy a aprender?
                <ChevronDown size={19} aria-hidden="true" />
              </summary>
              <p>
                {campusLanding.learning}
              </p>
            </details>
            <details name="preguntas-diplomado">
              <summary>
                ¿Cómo entro a mis clases?
                <ChevronDown size={19} aria-hidden="true" />
              </summary>
              <p>
                Selecciona «Entrar al aula» e ingresa el correo y la contraseña que recibiste al
                registrarte. Desde ahí encontrarás tus materias, calendario, calificaciones y
                biblioteca.
              </p>
              <button type="button" className={styles.inlineLink} onClick={openLogin}>
                Entrar al aula <ArrowRight size={16} aria-hidden="true" />
              </button>
            </details>
            <details name="preguntas-diplomado" id="inscripcion">
              <summary>
                ¿Cómo puedo inscribirme?
                <ChevronDown size={19} aria-hidden="true" />
              </summary>
              <p>
                La coordinación del diplomado gestiona las inscripciones y te proporciona tu cuenta
                de acceso. Comunícate a través del medio por el que recibiste la invitación para
                conocer fechas y disponibilidad.
              </p>
            </details>
            <details name="preguntas-diplomado">
              <summary>
                {campusLanding.applicationQuestion}
                <ChevronDown size={19} aria-hidden="true" />
              </summary>
              <p>
                {campusLanding.applicationAnswer}
              </p>
            </details>
          </div>
        </section>
        <section className={styles.finalCta} aria-labelledby="cta-title">
          <div>
            <span className={styles.eyebrow}>SIGUE APRENDIENDO</span>
            <h2 id="cta-title">{campusLanding.ctaTitle}</h2>
            <p>{campusLanding.ctaDescription}</p>
          </div>
          <a className={styles.lightButton} href="#modulos">
            Conocer el programa <ArrowRight size={18} aria-hidden="true" />
          </a>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <a href="#inicio" className={styles.brand}>
            <span className={styles.brandMark}>
              {isInnovationCampus ? <Lightbulb size={23} strokeWidth={1.7} aria-hidden="true" /> : <GraduationCap size={23} aria-hidden="true" />}
            </span>
            <span className={styles.brandText}>
              <strong>{campusBranding.name}</strong>
              <span>{campusBranding.subtitle}</span>
            </span>
          </a>
          <nav aria-label="Navegación del pie de página">
            <a href="#modulos">Programa</a>
            <a href="#maestro">Instructor</a>
            <a href="#contacto">Preguntas frecuentes</a>
            <button type="button" onClick={openLogin}>
              Entrar al aula <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          </nav>
        </div>
        <div className={styles.footerBottom}>
          <span>
            © {new Date().getFullYear()} {campusBranding.name}. Todos los derechos reservados.
          </span>
          <span>{campusBranding.slogan}.</span>
        </div>
      </footer>

      <dialog
        ref={dialogRef}
        className={styles.loginDialog}
        aria-labelledby="login-title"
        aria-describedby="login-description"
        onClose={() => {
          loginRequestRef.current?.abort();
          loginRequestRef.current = null;
          setLoading(false);
          setPassword('');
          setShowPassword(false);
          setError('');
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            dialogRef.current?.close();
        }}
      >
        <button
          type="button"
          className={styles.dialogClose}
          onClick={() => dialogRef.current?.close()}
          aria-label="Cerrar ventana de acceso"
        >
          <X size={20} />
        </button>
        <span className={styles.loginMark}>
          {isInnovationCampus ? <Lightbulb size={28} strokeWidth={1.7} aria-hidden="true" /> : <GraduationCap size={28} aria-hidden="true" />}
        </span>
        <span className={styles.eyebrow}>TU ESPACIO DE APRENDIZAJE</span>
        <h2 id="login-title">Qué bueno verte de nuevo.</h2>
        <p id="login-description">Entra a tu aula y continúa aprendiendo.</p>
        <form onSubmit={handleLogin} className={styles.loginForm} aria-busy={loading}>
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              Correo electrónico
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="tu@correo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              Contraseña
            </label>
            <div className={styles.passwordField}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>
          {error && (
            <p className={styles.loginError} role="alert">
              {error}
            </p>
          )}
          <button type="submit" className={styles.primaryButton} disabled={loading}>
            {loading ? (
              <>
                <LoaderCircle className="spin" size={18} aria-hidden="true" /> Iniciando sesión…
              </>
            ) : (
              <>
                Entrar al aula <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
        <p className={styles.loginHelp}>
          <LockKeyhole size={15} aria-hidden="true" />
          <span>
            Usa los datos que recibiste al inscribirte. Si necesitas ayuda, contacta a la
            coordinación del diplomado.
          </span>
        </p>
      </dialog>
    </div>
  );
}
