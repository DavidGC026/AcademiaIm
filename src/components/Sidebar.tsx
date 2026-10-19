'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Layers,
  FileCheck,
  Users,
  Settings,
  BarChart2,
  GraduationCap,
  UserCog,
  Calendar,
  Library,
  ArrowUpRight,
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { campusBranding } from '@/lib/campusBranding';

interface SidebarProps {
  role: 'administrador' | 'maestro' | 'estudiante';
}

const menus = {
  administrador: [
    { label: 'Aprobación de cursos', href: '/admin', icon: Layers },
    { label: 'Materias y contenido', href: '/admin/materias', icon: BookOpen },
    { label: 'Alumnos', href: '/admin/alumnos', icon: GraduationCap },
    { label: 'Usuarios', href: '/admin/users', icon: UserCog },
    { label: 'Grupos y cohortes', href: '/admin/grupos', icon: Users },
    { label: 'Configuración de IA', href: '/admin/config', icon: Settings },
    { label: 'Biblioteca', href: '/admin/biblioteca', icon: Library },
    { label: 'Perfil y contraseña', href: '/admin/perfil', icon: UserCog },
  ],
  maestro: [
    { label: 'Mis materias', href: '/maestro/materias', icon: BookOpen },
    { label: 'Tareas por calificar', href: '/maestro/tareas', icon: FileCheck },
    { label: 'Mis grupos', href: '/maestro/grupos', icon: Users },
    { label: 'Calendario', href: '/maestro/calendario', icon: Calendar },
    { label: 'Calificaciones', href: '/maestro/calificaciones', icon: BarChart2 },
    { label: 'Perfil y contraseña', href: '/maestro/perfil', icon: UserCog },
    { label: 'Biblioteca', href: '/maestro/biblioteca', icon: Library },
  ],
  estudiante: [
    { label: 'Mis materias', href: '/estudiante', icon: GraduationCap },
    { label: 'Calendario', href: '/estudiante/calendario', icon: Calendar },
    { label: 'Mis calificaciones', href: '/estudiante/calificaciones', icon: BarChart2 },
    { label: 'Perfil y contraseña', href: '/estudiante/perfil', icon: UserCog },
    { label: 'Biblioteca', href: '/estudiante/biblioteca', icon: Library },
  ],
};

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const menuItems = menus[role];
  const roleLabel =
    role === 'administrador'
      ? 'Administración'
      : role === 'maestro'
        ? 'Docencia'
        : 'Mi aprendizaje';
  const closeNav = () => document.body.classList.remove('nav-open');

  const containMobileFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || !window.matchMedia('(max-width: 900px)').matches) return;
    const links = event.currentTarget.querySelectorAll<HTMLAnchorElement>('a[href]');
    const first = links[0];
    const last = links[links.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.overlay}
        tabIndex={-1}
        onClick={() => {
          closeNav();
          document.querySelector<HTMLButtonElement>('.app-menu-btn')?.focus();
        }}
        aria-label="Cerrar menú"
      />
      <aside className={styles.sidebar} onKeyDown={containMobileFocus}>
        <div>
          <div className={styles.intro}>
            <span>CAMPUS DIGITAL</span>
            <p>
              Tu espacio para
              <br />
              seguir creciendo.
            </p>
          </div>
          <nav id="app-navigation" aria-label={roleLabel}>
            <div className={styles.sectionLabel}>{roleLabel}</div>
            <ul className={styles.list}>
              {menuItems.map((item, index) => {
                const isHome = index === 0;
                const isLearningContent =
                  role === 'estudiante' &&
                  /^\/estudiante\/(materias|clases|examenes)\//.test(pathname);
                const isTeachingContent = role === 'maestro' && item.href === '/maestro/materias' && /^\/maestro\/examenes\//.test(pathname);
                const isAdminContent = role === 'administrador' && item.href === '/admin/materias' && /^\/admin\/examenes\//.test(pathname);
                const active =
                  pathname === item.href || isTeachingContent || isAdminContent ||
                  (isHome && isLearningContent) ||
                  (item.href !== '/admin' && item.href !== '/estudiante' && pathname.startsWith(`${item.href}/`));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeNav}
                      title={item.label}
                      aria-label={item.label}
                      className={styles.link}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
                      <span className={styles.label}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        <div className={styles.footer}>
          <Link href="/" onClick={closeNav}>
            {campusBranding.aboutLabel} <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <span>
            {campusBranding.name}
            <br />
            {campusBranding.subtitle}
          </span>
        </div>
      </aside>
    </>
  );
}
