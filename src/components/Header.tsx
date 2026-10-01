'use client';

import { useRouter, usePathname } from 'next/navigation';
import { LogOut, GraduationCap, Menu, PanelLeft, PanelLeftClose } from 'lucide-react';
import { useEffect, useState } from 'react';

interface HeaderProps {
  user: {
    nombre: string;
    email: string;
    role: 'administrador' | 'maestro' | 'estudiante';
    grupo_cohorte?: string | null;
  } | null;
}

const SIDEBAR_KEY = 'ruadiplo-sidebar-collapsed';

export default function Header({ user }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.remove('nav-open');
  }, [pathname]);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 900px)');
    const syncNavigation = () => {
      const open = document.body.classList.contains('nav-open');
      setMenuOpen(open);
      setSidebarCollapsed(document.body.classList.contains('sidebar-collapsed'));
      const main = document.querySelector('main');
      if (main) main.inert = open && mobile.matches;
    };
    const observer = new MutationObserver(syncNavigation);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    mobile.addEventListener('change', syncNavigation);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.body.classList.contains('nav-open')) {
        document.body.classList.remove('nav-open');
        document.querySelector<HTMLButtonElement>('.app-menu-btn')?.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      observer.disconnect();
      mobile.removeEventListener('change', syncNavigation);
      document.removeEventListener('keydown', closeOnEscape);
      document.body.classList.remove('nav-open');
      const main = document.querySelector('main');
      if (main) main.inert = false;
    };
  }, []);

  useEffect(() => {
    const collapsed = localStorage.getItem(SIDEBAR_KEY) === '1';
    document.body.classList.toggle('sidebar-collapsed', collapsed);
  }, []);

  const toggleSidebar = () => {
    const next = !document.body.classList.contains('sidebar-collapsed');
    document.body.classList.toggle('sidebar-collapsed', next);
    localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
    setSidebarCollapsed(next);
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
    else if (user?.role === 'maestro') router.push('/maestro');
    else router.push('/estudiante');
  };

  return (
    <header className="app-header">
      <div className="app-header-left">
        <button
          type="button"
          className="app-menu-btn"
          onClick={() => document.body.classList.toggle('nav-open')}
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          aria-controls="app-navigation"
        >
          <Menu size={22} />
        </button>
        <button
          type="button"
          className="app-sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
          aria-expanded={!sidebarCollapsed}
          aria-controls="app-navigation"
          title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          {sidebarCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
        </button>
        <button type="button" onClick={goHome} className="app-header-logo-btn" aria-label="Inicio">
          <div className="app-header-logo-mark">
            <GraduationCap size={22} color="white" />
          </div>
        </button>
        <div className="app-header-divider" />
        <div className="app-header-brand">
          <span className="app-header-brand-main">ACADEMIA IMCYC</span>
          <span className="app-header-brand-sub">{user?.role === 'maestro' ? 'Panel de maestros' : user?.role === 'administrador' ? 'Administración' : 'Plataforma educativa'}</span>
        </div>
      </div>

      {user && (
        <div className="app-header-right">
          <div className="app-header-user-block">
            <span className="app-header-user-name">{user.nombre}</span>
            <div className="app-header-user-meta">
              {user.grupo_cohorte && (
                <span className="app-header-group">{user.grupo_cohorte}</span>
              )}
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="app-header-logout-btn" title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogOut size={18} />
            <span className="app-header-logout-text">Cerrar Sesión</span>
          </button>
        </div>
      )}
    </header>
  );
}
