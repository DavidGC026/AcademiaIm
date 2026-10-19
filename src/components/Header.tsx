'use client';

import { useRouter, usePathname } from 'next/navigation';
import { LogOut, Lightbulb, GraduationCap, Menu, PanelLeft, PanelLeftClose, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import WelcomeTutorial from './WelcomeTutorial';
import { campusBranding, isInnovationCampus } from '@/lib/campusBranding';

interface HeaderProps {
  user: {
    id?: number;
    nombre: string;
    email: string;
    role: 'administrador' | 'maestro' | 'estudiante';
    grupo_cohorte?: string | null;
  } | null;
}

const SIDEBAR_KEY = campusBranding.storageKey;

export default function Header({ user }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.body.classList.remove('nav-open');
  }, [pathname]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const open = document.body.classList.contains('nav-open');
      setMobileNavOpen(open);
      const main = document.querySelector('main');
      if (main) main.inert = open && window.matchMedia('(max-width: 900px)').matches;
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.body.classList.contains('nav-open')) {
        document.body.classList.remove('nav-open');
        menuButtonRef.current?.focus();
      }
    };
    const desktop = window.matchMedia('(min-width: 901px)');
    const closeOnDesktop = () => {
      if (desktop.matches) {
        document.body.classList.remove('nav-open');
        const main = document.querySelector('main');
        if (main) main.inert = false;
      }
    };
    desktop.addEventListener('change', closeOnDesktop);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      observer.disconnect();
      desktop.removeEventListener('change', closeOnDesktop);
      window.removeEventListener('keydown', closeOnEscape);
      document.body.classList.remove('nav-open', 'sidebar-collapsed');
      const main = document.querySelector('main');
      if (main) main.inert = false;
    };
  }, []);

  useEffect(() => {
    const collapsed = localStorage.getItem(SIDEBAR_KEY) === '1';
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    const frame = window.requestAnimationFrame(() => setSidebarCollapsed(collapsed));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const toggleSidebar = () => {
    const next = !document.body.classList.contains('sidebar-collapsed');
    document.body.classList.toggle('sidebar-collapsed', next);
    localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
    setSidebarCollapsed(next);
  };

  const toggleMobileNav = () => {
    const open = document.body.classList.toggle('nav-open');
    if (open) {
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>('#app-navigation [aria-current="page"], #app-navigation a')
          ?.focus();
      });
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const goHome = () => {
    if (user?.role === 'administrador') router.push('/admin');
    else if (user?.role === 'maestro') router.push('/maestro/materias');
    else router.push('/estudiante');
  };

  const userInitials = user?.nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <header className="app-header">
      <div className="app-header-left">
        <button
          ref={menuButtonRef}
          type="button"
          className="app-menu-btn"
          onClick={toggleMobileNav}
          aria-label={mobileNavOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileNavOpen}
          aria-controls="app-navigation"
        >
          {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <button
          type="button"
          className="app-sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
          title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
          aria-expanded={!sidebarCollapsed}
          aria-controls="app-navigation"
        >
          {sidebarCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
        </button>
        <button type="button" onClick={goHome} className="app-header-logo-btn" aria-label="Inicio">
          <div className="app-header-logo-mark">
            {isInnovationCampus ? <Lightbulb size={21} color="var(--accent-bright)" /> : <GraduationCap size={23} color="#fff" />}
          </div>
        </button>
        <div className="app-header-divider" />
        <div className="app-header-brand">
          <span className="app-header-brand-main">{campusBranding.name}</span>
          <span className="app-header-brand-sub">{campusBranding.subtitle}</span>
        </div>
      </div>

      {user && (
        <div className="app-header-right">
          {user.id && (
            <WelcomeTutorial key={`${user.id}-${user.role}`} userId={user.id} role={user.role} />
          )}
          <div className="app-header-avatar" aria-hidden="true">
            {userInitials || 'U'}
          </div>
          <div className="app-header-user-block">
            <span className="app-header-user-name">{user.nombre}</span>
            <div className="app-header-user-meta">
              <span className="app-header-role">
                {user.role === 'administrador'
                  ? 'Administrador'
                  : user.role === 'maestro'
                    ? 'Maestro'
                    : 'Estudiante'}
              </span>
              {user.grupo_cohorte && <span className="app-header-group">{user.grupo_cohorte}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="app-header-logout-btn"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} />
            <span className="app-header-logout-text">Cerrar sesión</span>
          </button>
        </div>
      )}
    </header>
  );
}
