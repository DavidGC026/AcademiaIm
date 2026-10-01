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
} from 'lucide-react';

interface SidebarProps {
  role: 'administrador' | 'maestro' | 'estudiante';
}

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  const getMenuItems = () => {
    switch (role) {
      case 'administrador':
        return [
          { label: 'Aprobación de Cursos', href: '/admin', icon: <Layers size={18} /> },
          { label: 'Materias y contenido', href: '/admin/materias', icon: <BookOpen size={18} /> },
          { label: 'Gestión de Alumnos', href: '/admin/alumnos', icon: <Users size={18} /> },
          { label: 'Gestión de Usuarios', href: '/admin/users', icon: <UserCog size={18} /> },
          { label: 'Grupos y Cohortes', href: '/admin/grupos', icon: <UserCog size={18} /> },
          { label: 'Configuración de IA', href: '/admin/config', icon: <Settings size={18} /> },
          { label: 'Biblioteca', href: '/admin/biblioteca', icon: <Library size={18} /> },
          { label: 'Perfil y contraseña', href: '/admin/perfil', icon: <UserCog size={18} /> },
        ];
      case 'maestro':
        return [
          { label: 'Mis materias', href: '/maestro/materias', icon: <BookOpen size={18} /> },
          { label: 'Tareas por calificar', href: '/maestro/tareas', icon: <FileCheck size={18} /> },
          { label: 'Mis grupos', href: '/maestro/grupos', icon: <Users size={18} /> },
          { label: 'Calendario', href: '/maestro/calendario', icon: <Calendar size={18} /> },
          { label: 'Calificaciones', href: '/maestro/calificaciones', icon: <BarChart2 size={18} /> },
          { label: 'Perfil y contraseña', href: '/maestro/perfil', icon: <UserCog size={18} /> },
          { label: 'Biblioteca', href: '/maestro/biblioteca', icon: <Library size={18} /> },
        ];
      case 'estudiante':
      default:
        return [
          { label: 'Mis Módulos', href: '/estudiante', icon: <GraduationCap size={18} /> },
          { label: 'Calendario', href: '/estudiante/calendario', icon: <Calendar size={18} /> },
          { label: 'Mis Calificaciones', href: '/estudiante/calificaciones', icon: <BarChart2 size={18} /> },
          { label: 'Mi Perfil', href: '/estudiante/perfil', icon: <UserCog size={18} /> },
          { label: 'Biblioteca', href: '/estudiante/biblioteca', icon: <Library size={18} /> },
        ];
    }
  };

  const menuItems = getMenuItems();
  const closeNav = () => document.body.classList.remove('nav-open');

  return (
    <>
      <button type="button" className="nav-overlay" onClick={closeNav} aria-label="Cerrar menú" />
      <aside className="app-sidebar" id="app-navigation">
        <nav style={styles.nav} aria-label="Menú principal">
          <div className="sidebar-section-header" style={styles.sectionHeader}>
            {role === 'maestro' ? 'ESPACIO DOCENTE' : role === 'estudiante' ? 'MI APRENDIZAJE' : 'ADMINISTRACIÓN'}
          </div>
          <ul style={styles.list}>
            {menuItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href + '/'));
              return (
                <li key={item.href} style={styles.item}>
                  <Link
                    href={item.href}
                    onClick={closeNav}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className="sidebar-link"
                    style={{
                      ...styles.link,
                      ...(isActive ? styles.activeLink : {}),
                    }}
                  >
                    <span style={isActive ? styles.activeIcon : styles.icon}>{item.icon}</span>
                    <span className="sidebar-label">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="sidebar-footer" style={styles.footer}>
          <span style={styles.footerText}>Academia IMCYC</span>
        </div>
      </aside>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: { display: 'flex', flexDirection: 'column', gap: '12px' },
  sectionHeader: {
    fontSize: '11px',
    fontWeight: '800',
    color: 'var(--text-secondary)',
    letterSpacing: '0.08em',
    paddingLeft: '12px',
    marginBottom: '8px',
  },
  list: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' },
  item: { width: '100%' },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    transition: 'var(--transition)',
  },
  activeLink: {
    backgroundColor: 'rgba(0, 115, 165, 0.08)',
    color: 'var(--primary)',
  },
  icon: { color: '#64748B', display: 'flex', alignItems: 'center' },
  activeIcon: { color: 'var(--primary)', display: 'flex', alignItems: 'center' },
  footer: { paddingLeft: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' },
  footerText: { fontSize: '11px', color: '#B0B3B5', fontWeight: '500' },
};
