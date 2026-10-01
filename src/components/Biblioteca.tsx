'use client';

import { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Video, 
  ShoppingBag, 
  Sparkles, 
  Globe,
  Plus,
  Edit2,
  Trash2,
  X,
  FileSearch,
} from 'lucide-react';
import ReferenciaViewer from '@/components/ReferenciaViewer';
import GrantLibroAcceso from '@/components/GrantLibroAcceso';
import FileResourcePreview from '@/components/FileResourcePreview';
import CheckoutModal from '@/components/CheckoutModal';
import { toAssetUrl, toBibliotecaContenidoUrl } from '@/lib/assetUrl';

interface Book {
  id: number;
  titulo: string;
  autor: string;
  precio: number;
  imagen: string;
  paginas: number;
  tienda_url: string;
  descripcion: string;
  archivo_url?: string | null;
  archivo_nombre?: string | null;
  comprado?: boolean;
  puede_leer?: boolean;
}

interface Magazine {
  id: number;
  edicion: string;
  fecha: string;
  imagen: string;
  link_descarga: string;
  descripcion: string;
  archivo_url?: string | null;
  archivo_nombre?: string | null;
  revista_del_mes?: number;
  mes_destacado?: string | null;
}

interface Interview {
  id: number;
  titulo: string;
  experto: string;
  cargo: string;
  video_url: string;
  duracion: string;
  descripcion: string;
}

interface InvestigacionItem {
  id: number;
  titulo: string;
  autor: string;
  descripcion: string;
  imagen: string;
  archivo_url?: string | null;
  archivo_nombre?: string | null;
}

export default function BibliotecaComponent() {
  const [activeTab, setActiveTab] = useState<'revistas' | 'libros' | 'entrevistas' | 'investigacion'>('libros');
  
  // Data loading states
  const [books, setBooks] = useState<Book[]>([]);
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [investigacion, setInvestigacion] = useState<InvestigacionItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Auth state
  const [userRole, setUserRole] = useState<string>('');
  const [accesoPrioritario, setAccesoPrioritario] = useState(false);
  
  // Admin CRUD state
  const [isCrudModalOpen, setIsCrudModalOpen] = useState(false);
  const [crudMode, setCrudMode] = useState<'add' | 'edit'>('add');
  const [editingItemType, setEditingItemType] = useState<'libro' | 'revista' | 'entrevista' | 'investigacion'>('libro');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  
  // Form states
  const [bookForm, setBookForm] = useState({
    titulo: '',
    autor: '',
    precio: 0,
    imagen: '/libro_concreto.png',
    paginas: 0,
    tienda_url: '',
    descripcion: '',
    archivo_url: '',
    archivo_nombre: '',
  });
  
  const [magazineForm, setMagazineForm] = useState({
    edicion: '',
    fecha: '',
    imagen: '/revista_cover.png',
    link_descarga: 'https://www.imcyc.com.mx/revista',
    descripcion: '',
    archivo_url: '',
    archivo_nombre: '',
    revista_del_mes: 0,
    mes_destacado: ''
  });
  
  const [interviewForm, setInterviewForm] = useState({
    titulo: '',
    experto: '',
    cargo: '',
    video_url: '',
    duracion: '10:00 min',
    descripcion: ''
  });

  const [investigacionForm, setInvestigacionForm] = useState({
    titulo: '',
    autor: '',
    descripcion: '',
    imagen: '/libro_concreto.png',
    archivo_url: '',
    archivo_nombre: '',
  });

  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [uploadingArchivo, setUploadingArchivo] = useState(false);
  const [uploadingPortada, setUploadingPortada] = useState(false);
  const [checkoutBook, setCheckoutBook] = useState<Book | null>(null);
  const [readerMagId, setReaderMagId] = useState<number | null>(null);
  const [accesoStaff, setAccesoStaff] = useState(false);
  const [bookPdfLocal, setBookPdfLocal] = useState<File | null>(null);
  const [magazinePdfLocal, setMagazinePdfLocal] = useState<File | null>(null);
  const [investigacionPdfLocal, setInvestigacionPdfLocal] = useState<File | null>(null);
  const [readerInvId, setReaderInvId] = useState<number | null>(null);

  const revistaContenidoUrl = (ref: string) => toBibliotecaContenidoUrl('revistas', ref);
  const libroContenidoUrl = (ref: string) => toBibliotecaContenidoUrl('libros', ref);
  const investigacionContenidoUrl = (ref: string) => toBibliotecaContenidoUrl('investigacion', ref);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al subir archivo');
    return { url: data.url as string, name: (data.name || file.name) as string };
  };

  // Sube el contenido del libro a almacenamiento privado (lectura protegida).
  const uploadBookContent = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/biblioteca/libros/contenido', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al subir archivo');
    return { url: data.ref as string, name: (data.name || file.name) as string };
  };

  const uploadRevistaContent = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/biblioteca/revistas/contenido', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al subir PDF');
    return { url: data.ref as string, name: (data.name || file.name) as string };
  };

  const uploadInvestigacionContent = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/biblioteca/investigacion/contenido', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al subir PDF');
    return { url: data.ref as string, name: (data.name || file.name) as string };
  };

  const persistLibroArchivo = async (libroId: number, archivo_url: string, archivo_nombre: string) => {
    const res = await fetch(`/api/biblioteca/libros?id=${libroId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivo_url, archivo_nombre }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudo vincular el PDF al libro');
  };

  const handleBookPdfUpload = async (file: File) => {
    setBookPdfLocal(file);
    setUploadingArchivo(true);
    try {
      const { url, name } = await uploadBookContent(file);
      setBookForm((prev) => ({ ...prev, archivo_url: url, archivo_nombre: name }));
      if (crudMode === 'edit' && selectedId) {
        await persistLibroArchivo(selectedId, url, name);
        setFeedback('PDF vinculado al libro.');
        await fetchData();
        setBookPdfLocal(null);
      }
    } finally {
      setUploadingArchivo(false);
    }
  };

  const handleMagazinePdfUpload = async (file: File) => {
    setMagazinePdfLocal(file);
    setUploadingArchivo(true);
    try {
      const { url, name } = await uploadRevistaContent(file);
      setMagazineForm((prev) => ({ ...prev, archivo_url: url, archivo_nombre: name }));
      if (crudMode === 'edit' && selectedId) {
        const res = await fetch(`/api/biblioteca/revistas?id=${selectedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archivo_url: url, archivo_nombre: name }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'No se pudo vincular el PDF');
        }
        setFeedback('PDF vinculado a la revista.');
        await fetchData();
        setMagazinePdfLocal(null);
      }
    } finally {
      setUploadingArchivo(false);
    }
  };

  const handleInvestigacionPdfUpload = async (file: File) => {
    setInvestigacionPdfLocal(file);
    setUploadingArchivo(true);
    try {
      const { url, name } = await uploadInvestigacionContent(file);
      setInvestigacionForm((prev) => ({ ...prev, archivo_url: url, archivo_nombre: name }));
      if (crudMode === 'edit' && selectedId) {
        const res = await fetch(`/api/biblioteca/investigacion?id=${selectedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archivo_url: url, archivo_nombre: name }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'No se pudo vincular el PDF');
        }
        setFeedback('PDF vinculado al material de investigación.');
        await fetchData();
        setInvestigacionPdfLocal(null);
      }
    } finally {
      setUploadingArchivo(false);
    }
  };

  const puedeLeer = (book: Book) =>
    book.puede_leer ??
    (userRole === 'administrador' ||
      userRole === 'maestro' ||
      accesoPrioritario ||
      !!book.comprado);

  const getDriveEmbedUrl = (url: string | null) => {
    if (!url) return '';
    try {
      if (url.includes('drive.google.com')) {
        const parts = url.split('/d/');
        if (parts.length > 1) {
          const fileId = parts[1].split('/')[0];
          return `https://drive.google.com/file/d/${fileId}/preview`;
        }
      }
    } catch (e) {
      console.warn('Fallo al parsear Drive URL:', e);
    }
    return url;
  };

  // Fetch session and data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Session
      const sessionRes = await fetch('/api/auth/session');
      if (sessionRes.ok) {
        const { session } = await sessionRes.json();
        if (session) {
          setUserRole(session.roleName);
          setAccesoPrioritario(!!session.acceso_prioritario);
          if (session.roleName === 'maestro' || session.roleName === 'administrador') {
            setAccesoStaff(true);
          }
        }
      }

      // 2. Fetch Books
      const booksRes = await fetch('/api/biblioteca/libros');
      if (booksRes.ok) {
        const data = await booksRes.json();
        setBooks(data.libros || []);
        if (data.acceso_prioritario) setAccesoPrioritario(true);
        if (data.acceso_staff) setAccesoStaff(true);
      }

      // 3. Fetch Magazines
      const magsRes = await fetch('/api/biblioteca/revistas');
      if (magsRes.ok) {
        const data = await magsRes.json();
        setMagazines(data.revistas || []);
      }

      // 4. Fetch Interviews
      const interviewsRes = await fetch('/api/biblioteca/entrevistas');
      if (interviewsRes.ok) {
        const data = await interviewsRes.json();
        setInterviews(data.entrevistas || []);
      }

      const invRes = await fetch('/api/biblioteca/investigacion');
      if (invRes.ok) {
        const data = await invRes.json();
        setInvestigacion(data.investigacion || []);
      }
    } catch (error) {
      console.error('Error al cargar datos de la biblioteca:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddModal = (type: 'libro' | 'revista' | 'entrevista' | 'investigacion') => {
    setEditingItemType(type);
    setCrudMode('add');
    setSelectedId(null);
    setFormError('');
    
    setBookPdfLocal(null);
    setMagazinePdfLocal(null);
    setInvestigacionPdfLocal(null);
    
    // Reset forms
    setBookForm({
      titulo: '',
      autor: '',
      precio: 0,
      imagen: '/libro_concreto.png',
      paginas: 0,
      tienda_url: '',
      descripcion: '',
      archivo_url: '',
      archivo_nombre: '',
    });
    setMagazineForm({
      edicion: '',
      fecha: '',
      imagen: '/revista_cover.png',
      link_descarga: 'https://www.imcyc.com.mx/revista',
      descripcion: '',
      archivo_url: '',
      archivo_nombre: '',
      revista_del_mes: 0,
      mes_destacado: ''
    });
    setInterviewForm({
      titulo: '',
      experto: '',
      cargo: '',
      video_url: '',
      duracion: '10:00 min',
      descripcion: ''
    });
    setInvestigacionForm({
      titulo: '',
      autor: '',
      descripcion: '',
      imagen: '/libro_concreto.png',
      archivo_url: '',
      archivo_nombre: '',
    });
    
    setIsCrudModalOpen(true);
  };

  const handleOpenEditModal = (type: 'libro' | 'revista' | 'entrevista' | 'investigacion', item: any) => {
    setEditingItemType(type);
    setCrudMode('edit');
    setSelectedId(item.id);
    setFormError('');
    setBookPdfLocal(null);
    setMagazinePdfLocal(null);
    setInvestigacionPdfLocal(null);
    
    if (type === 'libro') {
      setBookForm({
        titulo: item.titulo,
        autor: item.autor,
        precio: Number(item.precio),
        imagen: item.imagen,
        paginas: item.paginas,
        tienda_url: item.tienda_url,
        descripcion: item.descripcion,
        archivo_url: item.archivo_url || '',
        archivo_nombre: item.archivo_nombre || '',
      });
    } else if (type === 'revista') {
      setMagazineForm({
        edicion: item.edicion,
        fecha: item.fecha,
        imagen: item.imagen,
        link_descarga: item.link_descarga,
        descripcion: item.descripcion,
        archivo_url: item.archivo_url || '',
        archivo_nombre: item.archivo_nombre || '',
        revista_del_mes: item.revista_del_mes || 0,
        mes_destacado: item.mes_destacado || ''
      });
    } else if (type === 'entrevista') {
      setInterviewForm({
        titulo: item.titulo,
        experto: item.experto,
        cargo: item.cargo,
        video_url: item.video_url,
        duracion: item.duracion,
        descripcion: item.descripcion
      });
    } else {
      setInvestigacionForm({
        titulo: item.titulo,
        autor: item.autor,
        descripcion: item.descripcion,
        imagen: item.imagen,
        archivo_url: item.archivo_url || '',
        archivo_nombre: item.archivo_nombre || '',
      });
    }
    
    setIsCrudModalOpen(true);
  };

  const handleDeleteItem = async (type: 'libro' | 'revista' | 'entrevista' | 'investigacion', id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este elemento de forma permanente?')) return;
    
    const endpointMap = {
      libro: 'libros',
      revista: 'revistas',
      entrevista: 'entrevistas',
      investigacion: 'investigacion',
    };
    
    try {
      const res = await fetch(`/api/biblioteca/${endpointMap[type]}?id=${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setFeedback('Elemento eliminado correctamente.');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al eliminar');
      }
    } catch (err) {
      console.error('Error delete:', err);
      alert('Error de conexión');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setActionLoading(true);
    
    const endpointMap = {
      libro: 'libros',
      revista: 'revistas',
      entrevista: 'entrevistas',
      investigacion: 'investigacion',
    };
    
    const endpoint = `/api/biblioteca/${endpointMap[editingItemType]}${crudMode === 'edit' ? `?id=${selectedId}` : ''}`;
    const method = crudMode === 'add' ? 'POST' : 'PUT';
    
    let bodyData: any = {};
    if (editingItemType === 'libro') {
      bodyData = bookForm;
    } else if (editingItemType === 'revista') {
      bodyData = magazineForm;
    } else if (editingItemType === 'entrevista') {
      bodyData = interviewForm;
    } else {
      bodyData = investigacionForm;
    }
    
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      
      if (res.ok) {
        setIsCrudModalOpen(false);
        setBookPdfLocal(null);
        setMagazinePdfLocal(null);
        setFeedback(crudMode === 'add' ? 'Libro agregado correctamente.' : 'Cambios guardados correctamente.');
        fetchData();
      } else {
        const data = await res.json();
        setFormError(data.error || 'Error al guardar los cambios');
      }
    } catch (err) {
      console.error('Submit error:', err);
      setFormError('Error de red al guardar');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <div style={styles.hero}>
        <div style={styles.heroLeft}>
          <h1 style={styles.title}>Centro de Conocimiento IMCYC</h1>
          <p style={styles.subtitle}>
            Accede al acervo técnico oficial: revista digital, literatura científica, entrevistas exclusivas y manuales especializados del cemento y concreto.
          </p>
        </div>
        <div style={styles.heroBadge}>
          <Sparkles size={16} color="#0073A5" />
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0073A5' }}>Valor Agregado Académico</span>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            backgroundColor: feedback.includes('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            color: feedback.includes('Error') ? '#EF4444' : 'var(--success)',
            border: '1px solid var(--border)',
          }}
        >
          {feedback}
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabsContainer}>
        <button 
          onClick={() => setActiveTab('revistas')}
          style={{ ...styles.tabBtn, ...(activeTab === 'revistas' ? styles.activeTabBtn : {}) }}
        >
          <Globe size={18} />
          Revista Digital
        </button>
        <button 
          onClick={() => setActiveTab('libros')}
          style={{ ...styles.tabBtn, ...(activeTab === 'libros' ? styles.activeTabBtn : {}) }}
        >
          <BookOpen size={18} />
          Libros y Manuales
        </button>
        <button 
          onClick={() => setActiveTab('entrevistas')}
          style={{ ...styles.tabBtn, ...(activeTab === 'entrevistas' ? styles.activeTabBtn : {}) }}
        >
          <Video size={18} />
          Entrevistas Técnicas
        </button>
        <button 
          onClick={() => setActiveTab('investigacion')}
          style={{ ...styles.tabBtn, ...(activeTab === 'investigacion' ? styles.activeTabBtn : {}) }}
        >
          <FileSearch size={18} />
          Material de Investigación
        </button>
      </div>

      {loading ? (
        <div style={styles.loadingWrapper}>
          <div style={styles.spinner}></div>
          <p style={{ marginTop: '16px', color: '#64748B', fontWeight: '600' }}>Cargando acervo de la biblioteca...</p>
        </div>
      ) : (
        <div style={{ marginTop: '28px' }}>
          
          {/* REVISTAS TAB */}
          {activeTab === 'revistas' && (
            <div>
              {userRole === 'administrador' && (
                <button onClick={() => handleOpenAddModal('revista')} style={styles.addBtn}>
                  <Plus size={16} /> Agregar Nueva Revista
                </button>
              )}

              {magazines.length === 0 ? (
                <div style={styles.emptyState}>No hay revistas registradas en la biblioteca.</div>
              ) : (
                <>
                  {/* Revista del Mes Hero */}
                  {(() => {
                    const revistaDelMes = magazines.find(m => m.revista_del_mes === 1);
                    if (!revistaDelMes) return null;
                    
                    const isDrive = revistaDelMes.link_descarga.includes('drive.google.com');

                    return (
                      <div className="card" style={{ ...styles.magCard, border: '2px solid #0073A5', marginBottom: '40px', backgroundColor: '#F0F9FF' }}>
                        <div style={{ position: 'absolute', top: '-12px', left: '20px', backgroundColor: '#0073A5', color: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, zIndex: 5 }}>
                          REVISTA DEL MES: {revistaDelMes.mes_destacado || revistaDelMes.fecha}
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '32px', width: '100%' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ ...styles.magImageWrapper, width: '100%', height: '400px' }}>
                              <img src={toAssetUrl(revistaDelMes.imagen)} alt={revistaDelMes.edicion} style={styles.magImageSelf} />
                            </div>
                            {!revistaDelMes.archivo_url && (
                              <a 
                                href={revistaDelMes.link_descarga} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="btn btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px' }}
                              >
                                <Globe size={16} /> Enlace externo
                              </a>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <h2 style={{ ...styles.magTitle, fontSize: '28px' }}>{revistaDelMes.edicion}</h2>
                            <p style={{ ...styles.magDesc, fontSize: '16px', marginBottom: '24px' }}>{revistaDelMes.descripcion}</p>
                            
                            <div style={{ flex: 1, minHeight: '400px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                              {revistaDelMes.archivo_url ? (
                                <FileResourcePreview
                                  fileName={revistaDelMes.archivo_nombre || 'revista.pdf'}
                                  fileUrl={revistaContenidoUrl(revistaDelMes.archivo_url)}
                                  maxHeight={560}
                                  securePdf
                                  showSideNav
                                />
                              ) : isDrive ? (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: '40px', textAlign: 'center' }}>
                                  <Globe size={48} color="#B0B3B5" style={{ marginBottom: '16px' }} />
                                  <p style={{ fontWeight: 700, color: '#64748B' }}>Sube el PDF en administración para lectura protegida aquí.</p>
                                  <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '8px' }}>El enlace externo no permite controlar la descarga.</p>
                                </div>
                              ) : (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: '40px', textAlign: 'center' }}>
                                  <Globe size={48} color="#B0B3B5" style={{ marginBottom: '16px' }} />
                                  <p style={{ fontWeight: 700, color: '#64748B' }}>Lectura en línea no disponible para esta edición.</p>
                                  <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '8px' }}>El administrador debe subir el PDF para lectura en la plataforma.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0073A5', marginBottom: '6px' }}>
                      Archivo de Ediciones
                    </h2>
                    <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
                      Explora las publicaciones anteriores de la Revista Construcción y Tecnología.
                    </p>
                  </div>

                  <div style={styles.magList}>
                    {magazines.filter(m => m.revista_del_mes !== 1).map((mag) => (
                      <div key={mag.id} className="card" style={styles.magCard}>
                        {userRole === 'administrador' && (
                          <div style={styles.adminCardActions}>
                            <button onClick={() => handleOpenEditModal('revista', mag)} style={styles.editCardBtn} title="Editar">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDeleteItem('revista', mag.id)} style={styles.deleteCardBtn} title="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}

                        <div style={styles.magImageWrapper}>
                          <img src={toAssetUrl(mag.imagen)} alt={mag.edicion} style={styles.magImageSelf} />
                        </div>
                        <div style={styles.magInfo}>
                          <div style={styles.magHeader}>
                            <span className="badge badge-approved" style={{ backgroundColor: 'rgba(0,115,165,0.08)', color: '#0073A5' }}>
                              Revista Digital
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>{mag.fecha}</span>
                          </div>
                          <h3 style={styles.magTitle}>{mag.edicion}</h3>
                          <p style={styles.magDesc}>{mag.descripcion}</p>
                          
                          <div style={styles.magFeatures}>
                            <div style={styles.magFeatureItem}>✓ Lectura digital en la plataforma</div>
                            <div style={styles.magFeatureItem}>✓ Sin descarga del archivo</div>
                            <div style={styles.magFeatureItem}>✓ Artículos indexados de la Academia IMCYC</div>
                          </div>

                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {mag.archivo_url ? (
                              <button
                                type="button"
                                onClick={() => setReaderMagId(readerMagId === mag.id ? null : mag.id)}
                                className="btn btn-primary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}
                              >
                                <BookOpen size={16} /> {readerMagId === mag.id ? 'Ocultar lectura' : 'Leer aquí'}
                              </button>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#64748B' }}>PDF no disponible para lectura en plataforma.</span>
                            )}
                          </div>
                          {readerMagId === mag.id && mag.archivo_url && (
                            <div style={{ marginTop: '16px', width: '100%' }}>
                              <FileResourcePreview
                                fileName={mag.archivo_nombre || 'revista.pdf'}
                                fileUrl={revistaContenidoUrl(mag.archivo_url)}
                                maxHeight={520}
                                securePdf
                                showSideNav
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* LIBROS TAB */}
          {activeTab === 'libros' && (
            <div>
              {userRole === 'administrador' && (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0073A5', marginBottom: '6px' }}>
                      Gestión de libros
                    </h2>
                    <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
                      Sube portada y archivo digital, edita datos o elimina títulos del catálogo.
                    </p>
                  </div>
                  <button onClick={() => handleOpenAddModal('libro')} style={styles.addBtn}>
                    <Plus size={16} /> Agregar nuevo libro
                  </button>
                </>
              )}

              {books.length === 0 ? (
                <div style={styles.emptyState}>No hay libros registrados en la biblioteca.</div>
              ) : (
                <div style={styles.booksGrid}>
                  {books.map((book) => (
                    <div key={book.id} className="card" style={styles.bookCard}>
                      {userRole === 'administrador' && (
                        <div style={styles.adminCardActions}>
                          <button onClick={() => handleOpenEditModal('libro', book)} style={styles.editCardBtn} title="Editar">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteItem('libro', book.id)} style={styles.deleteCardBtn} title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                      <ReferenciaViewer
                        referencia={{ tipo: 'biblioteca', ...book }}
                        accesoPrioritario={userRole === 'estudiante' && accesoPrioritario}
                        accesoStaff={accesoStaff || userRole === 'maestro' || userRole === 'administrador'}
                        canRead={puedeLeer(book)}
                        showBuyButton={userRole === 'estudiante'}
                        onComprar={() => setCheckoutBook(book)}
                      />
                      {(userRole === 'maestro' || userRole === 'administrador') && (
                        <GrantLibroAcceso libroId={book.id} titulo={book.titulo} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ENTREVISTAS TAB */}
          {activeTab === 'entrevistas' && (
            <div>
              {userRole === 'administrador' && (
                <button onClick={() => handleOpenAddModal('entrevista')} style={styles.addBtn}>
                  <Plus size={16} /> Agregar Nueva Entrevista
                </button>
              )}

              {interviews.length === 0 ? (
                <div style={styles.emptyState}>No hay entrevistas grabadas en la biblioteca.</div>
              ) : (
                <div style={styles.interviewsGrid}>
                  {interviews.map((int) => (
                    <div key={int.id} className="card" style={styles.interviewCard}>
                      {userRole === 'administrador' && (
                        <div style={styles.adminCardActions}>
                          <button onClick={() => handleOpenEditModal('entrevista', int)} style={styles.editCardBtn} title="Editar">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteItem('entrevista', int.id)} style={styles.deleteCardBtn} title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}

                      <div style={styles.videoPlaceholderCard}>
                        <iframe
                          src={int.video_url}
                          style={styles.videoIframe}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                      <div style={styles.interviewInfo}>
                        <div style={styles.durationBadge}>
                          <Video size={12} /> {int.duracion}
                        </div>
                        <h3 style={styles.interviewTitle}>{int.titulo}</h3>
                        <div style={styles.expertBlock}>
                          <strong>{int.experto}</strong>
                          <span>{int.cargo}</span>
                        </div>
                        <p style={styles.interviewDesc}>{int.descripcion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* INVESTIGACIÓN TAB — acceso gratuito para usuarios autenticados */}
          {activeTab === 'investigacion' && (
            <div>
              {userRole === 'administrador' && (
                <button onClick={() => handleOpenAddModal('investigacion')} style={styles.addBtn}>
                  <Plus size={16} /> Agregar Material de Investigación
                </button>
              )}

              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0073A5', marginBottom: '6px' }}>
                  Material de Investigación
                </h2>
                <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
                  Documentos técnicos y papers de acceso gratuito para todos los usuarios de la plataforma.
                </p>
              </div>

              {investigacion.length === 0 ? (
                <div style={styles.emptyState}>No hay material de investigación publicado.</div>
              ) : (
                <div style={styles.magList}>
                  {investigacion.map((doc) => (
                    <div key={doc.id} className="card" style={styles.magCard}>
                      {userRole === 'administrador' && (
                        <div style={styles.adminCardActions}>
                          <button onClick={() => handleOpenEditModal('investigacion', doc)} style={styles.editCardBtn} title="Editar">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteItem('investigacion', doc.id)} style={styles.deleteCardBtn} title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}

                      <div style={styles.magImageWrapper}>
                        <img src={toAssetUrl(doc.imagen)} alt={doc.titulo} style={styles.magImageSelf} />
                      </div>
                      <div style={styles.magInfo}>
                        <div style={styles.magHeader}>
                          <span className="badge badge-approved" style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                            Acceso gratuito
                          </span>
                        </div>
                        <h3 style={styles.magTitle}>{doc.titulo}</h3>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748B', margin: '0 0 8px' }}>{doc.autor}</p>
                        <p style={styles.magDesc}>{doc.descripcion}</p>

                        {doc.archivo_url ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setReaderInvId(readerInvId === doc.id ? null : doc.id)}
                              className="btn btn-primary"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', width: 'fit-content', marginTop: '8px' }}
                            >
                              <BookOpen size={16} /> {readerInvId === doc.id ? 'Ocultar lectura' : 'Leer aquí'}
                            </button>
                            {readerInvId === doc.id && (
                              <div style={{ marginTop: '16px' }}>
                                <FileResourcePreview
                                  fileName={doc.archivo_nombre || 'documento.pdf'}
                                  fileUrl={investigacionContenidoUrl(doc.archivo_url)}
                                  maxHeight={480}
                                  securePdf
                                  showSideNav
                                />
                              </div>
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#64748B' }}>PDF pendiente de carga por administración.</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* CRUD MODAL FOR ADMIN */}
      {isCrudModalOpen && (
        <div style={styles.overlay}>
          <div className="card" style={styles.modal}>
            <button onClick={() => setIsCrudModalOpen(false)} style={styles.closeBtn}>
              <X size={20} />
            </button>

            <h3 style={styles.modalTitle}>
              {crudMode === 'add' ? 'Agregar Nuevo Recurso' : 'Editar Recurso'} ({editingItemType.toUpperCase()})
            </h3>

            {formError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid #EF4444', borderRadius: '8px', padding: '12px', marginBottom: '16px', color: '#EF4444', fontSize: '13px', fontWeight: '600' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              {/* LIBRO FORM */}
              {editingItemType === 'libro' && (
                <div>
                  <div className="form-group">
                    <label className="form-label">Título del Libro</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={bookForm.titulo} 
                      onChange={(e) => setBookForm({ ...bookForm, titulo: e.target.value })} 
                      placeholder="Ej. Tecnología del Concreto Avanzado"
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Autor(es)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={bookForm.autor} 
                      onChange={(e) => setBookForm({ ...bookForm, autor: e.target.value })} 
                      placeholder="Ej. Ing. Juan Pérez & Dra. Laura Gómez"
                      required 
                    />
                  </div>

                  <div className="grid-2" style={{ gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Precio ($ MXN)</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={bookForm.precio} 
                        onChange={(e) => setBookForm({ ...bookForm, precio: Number(e.target.value) })} 
                        placeholder="Ej. 650"
                        min="0"
                        required 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Páginas</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        value={bookForm.paginas} 
                        onChange={(e) => setBookForm({ ...bookForm, paginas: Number(e.target.value) })} 
                        placeholder="Ej. 320"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label className="form-label">Enlace tienda (solo copia física, opcional)</label>
                    <input 
                      type="url" 
                      className="form-input" 
                      value={bookForm.tienda_url} 
                      onChange={(e) => setBookForm({ ...bookForm, tienda_url: e.target.value })} 
                      placeholder="Ej. https://tienda.imcyc.com/products/libro-concreto"
                    />
                    <p style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>
                      La compra digital se hace aquí con Openpay. Este enlace solo aplica si vendes copia impresa en la tienda externa.
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Portada del libro</label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <select
                        className="form-select"
                        style={{ flex: 1, minWidth: '200px' }}
                        value={['/libro_concreto.png', '/libro_control.png'].includes(bookForm.imagen) ? bookForm.imagen : ''}
                        onChange={(e) => e.target.value && setBookForm({ ...bookForm, imagen: e.target.value })}
                      >
                        <option value="">— Portada personalizada —</option>
                        <option value="/libro_concreto.png">Plantilla: Tecnología del Concreto</option>
                        <option value="/libro_control.png">Plantilla: Control de Calidad</option>
                      </select>
                      <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                        {uploadingPortada ? 'Subiendo...' : 'Subir portada'}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          disabled={uploadingPortada}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingPortada(true);
                            try {
                              const { url } = await uploadFile(file);
                              setBookForm((prev) => ({ ...prev, imagen: url }));
                            } catch {
                              alert('Error al subir portada');
                            } finally {
                              setUploadingPortada(false);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    </div>
                    {bookForm.imagen && (
                      <img
                        src={toAssetUrl(bookForm.imagen)}
                        alt="Vista previa portada"
                        style={{ maxHeight: '100px', borderRadius: '6px', border: '1px solid var(--border)' }}
                      />
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Descripción</label>
                    <textarea 
                      className="form-input" 
                      style={{ minHeight: '100px', resize: 'vertical' }}
                      value={bookForm.descripcion} 
                      onChange={(e) => setBookForm({ ...bookForm, descripcion: e.target.value })} 
                      placeholder="Sinopsis o detalles técnicos del libro..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Archivo PDF para lectura en plataforma (opcional)</label>
                    <p style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px' }}>
                      Solo PDF. Al subir en un libro existente se guarda al instante. En uno nuevo, pulsa Guardar después.
                    </p>
                    <input
                      type="file"
                      accept=".pdf"
                      disabled={uploadingArchivo}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          await handleBookPdfUpload(file);
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Error al subir archivo');
                        } finally {
                          e.target.value = '';
                        }
                      }}
                      style={{ fontSize: '12px', marginBottom: '8px' }}
                    />
                    {bookForm.archivo_url && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0073A5' }}>
                            {bookForm.archivo_nombre || bookForm.archivo_url}
                          </span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => {
                              setBookForm((prev) => ({ ...prev, archivo_url: '', archivo_nombre: '' }));
                              setBookPdfLocal(null);
                            }}
                          >
                            Quitar archivo
                          </button>
                        </div>
                        <FileResourcePreview
                          fileName={bookForm.archivo_nombre || bookForm.archivo_url || 'documento.pdf'}
                          fileUrl={bookForm.archivo_url ? libroContenidoUrl(bookForm.archivo_url) : undefined}
                          localFile={bookPdfLocal}
                          maxHeight={280}
                          securePdf
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* REVISTA FORM */}
              {editingItemType === 'revista' && (
                <div>
                  <div className="form-group">
                    <label className="form-label">Nombre de la Edición</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={magazineForm.edicion} 
                      onChange={(e) => setMagazineForm({ ...magazineForm, edicion: e.target.value })} 
                      placeholder="Ej. Edición Especial: Aditivos del Futuro"
                      required 
                    />
                  </div>

                  <div className="grid-2" style={{ gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Fecha de Publicación</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={magazineForm.fecha} 
                        onChange={(e) => setMagazineForm({ ...magazineForm, fecha: e.target.value })} 
                        placeholder="Ej. Junio 2026"
                        required 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Mes Destacado (Label)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={magazineForm.mes_destacado} 
                        onChange={(e) => setMagazineForm({ ...magazineForm, mes_destacado: e.target.value })} 
                        placeholder="Ej. JUNIO 2026"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={magazineForm.revista_del_mes === 1} 
                        onChange={(e) => setMagazineForm({ ...magazineForm, revista_del_mes: e.target.checked ? 1 : 0 })} 
                      />
                      Marcar como "Revista del Mes" (se mostrará en el Hero principal)
                    </label>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Enlace de Lectura / Descarga (Google Drive o Externo)</label>
                    <input 
                      type="url" 
                      className="form-input" 
                      value={magazineForm.link_descarga} 
                      onChange={(e) => setMagazineForm({ ...magazineForm, link_descarga: e.target.value })} 
                      placeholder="Ej. https://www.imcyc.com.mx/revista o link de Drive"
                      required 
                    />
                    <small style={{ fontSize: '11px', color: '#64748B' }}>
                      Si pegas un link de Google Drive, asegúrate de que esté compartido como "Cualquiera con el enlace".
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Portada de la revista</label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <select 
                        className="form-select" 
                        style={{ flex: 1, minWidth: '200px' }}
                        value={magazineForm.imagen === '/revista_cover.png' ? magazineForm.imagen : ''} 
                        onChange={(e) => e.target.value && setMagazineForm({ ...magazineForm, imagen: e.target.value })}
                      >
                        <option value="">— Portada personalizada —</option>
                        <option value="/revista_cover.png">Portada Revista Construcción y Tecnología</option>
                      </select>
                      <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                        {uploadingPortada ? 'Subiendo...' : 'Subir portada'}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          disabled={uploadingPortada}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingPortada(true);
                            try {
                              const { url } = await uploadFile(file);
                              setMagazineForm((prev) => ({ ...prev, imagen: url }));
                            } catch {
                              alert('Error al subir portada');
                            } finally {
                              setUploadingPortada(false);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    </div>
                    {magazineForm.imagen && (
                      <img 
                        src={toAssetUrl(magazineForm.imagen)} 
                        alt="Vista previa" 
                        style={{ maxHeight: '100px', borderRadius: '6px', border: '1px solid var(--border)' }} 
                      />
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Descripción / Reportaje Central</label>
                    <textarea 
                      className="form-input" 
                      style={{ minHeight: '100px', resize: 'vertical' }}
                      value={magazineForm.descripcion} 
                      onChange={(e) => setMagazineForm({ ...magazineForm, descripcion: e.target.value })} 
                      placeholder="Escribe el resumen del reportaje principal..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Archivo PDF para lectura en plataforma (recomendado)</label>
                    <p style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px' }}>
                      Solo PDF. Los alumnos lo leen aquí con visor protegido (sin descarga).
                    </p>
                    <input
                      type="file"
                      accept=".pdf"
                      disabled={uploadingArchivo}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          await handleMagazinePdfUpload(file);
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Error al subir PDF');
                        } finally {
                          e.target.value = '';
                        }
                      }}
                      style={{ fontSize: '12px', marginBottom: '8px' }}
                    />
                    {magazineForm.archivo_url && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0073A5' }}>
                            {magazineForm.archivo_nombre || 'PDF Cargado'}
                          </span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => {
                              setMagazineForm((prev) => ({ ...prev, archivo_url: '', archivo_nombre: '' }));
                              setMagazinePdfLocal(null);
                            }}
                          >
                            Quitar PDF
                          </button>
                        </div>
                        <FileResourcePreview
                          fileName={magazineForm.archivo_nombre || magazineForm.archivo_url || 'revista.pdf'}
                          fileUrl={magazineForm.archivo_url ? revistaContenidoUrl(magazineForm.archivo_url) : undefined}
                          localFile={magazinePdfLocal}
                          maxHeight={280}
                          securePdf
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ENTREVISTA FORM */}
              {editingItemType === 'entrevista' && (
                <div>
                  <div className="form-group">
                    <label className="form-label">Título de la Entrevista / Charla</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={interviewForm.titulo} 
                      onChange={(e) => setInterviewForm({ ...interviewForm, titulo: e.target.value })} 
                      placeholder="Ej. Avances en Nanotecnología del Cemento"
                      required 
                    />
                  </div>

                  <div className="grid-2" style={{ gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Experto / Ponente</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={interviewForm.experto} 
                        onChange={(e) => setInterviewForm({ ...interviewForm, experto: e.target.value })} 
                        placeholder="Ej. Dr. Luis Morales"
                        required 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Duración</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={interviewForm.duracion} 
                        onChange={(e) => setInterviewForm({ ...interviewForm, duracion: e.target.value })} 
                        placeholder="Ej. 15:30 min"
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label className="form-label">Cargo / Afiliación del Experto</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={interviewForm.cargo} 
                      onChange={(e) => setInterviewForm({ ...interviewForm, cargo: e.target.value })} 
                      placeholder="Ej. Catedrático e Investigador de Materiales, UNAM"
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">URL del Video Embebido (YouTube/Drive)</label>
                    <input 
                      type="url" 
                      className="form-input" 
                      value={interviewForm.video_url} 
                      onChange={(e) => setInterviewForm({ ...interviewForm, video_url: e.target.value })} 
                      placeholder="Ej. https://www.youtube.com/embed/F429Z5dF_vU"
                      required 
                    />
                    <small style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '4px' }}>
                      Tip: Asegúrate de ingresar el formato de inserción (/embed/ID en YouTube).
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Descripción</label>
                    <textarea 
                      className="form-input" 
                      style={{ minHeight: '100px', resize: 'vertical' }}
                      value={interviewForm.descripcion} 
                      onChange={(e) => setInterviewForm({ ...interviewForm, descripcion: e.target.value })} 
                      placeholder="Resumen del contenido de la charla o puntos clave tratados..."
                    />
                  </div>
                </div>
              )}

              {/* INVESTIGACIÓN FORM */}
              {editingItemType === 'investigacion' && (
                <div>
                  <p style={{ fontSize: '12px', color: '#10B981', fontWeight: 600, marginBottom: '12px' }}>
                    Este material será de acceso gratuito para todos los usuarios autenticados.
                  </p>
                  <div className="form-group">
                    <label className="form-label">Título</label>
                    <input type="text" className="form-input" value={investigacionForm.titulo} onChange={(e) => setInvestigacionForm({ ...investigacionForm, titulo: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Autor / institución</label>
                    <input type="text" className="form-input" value={investigacionForm.autor} onChange={(e) => setInvestigacionForm({ ...investigacionForm, autor: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descripción</label>
                    <textarea className="form-input" rows={3} value={investigacionForm.descripcion} onChange={(e) => setInvestigacionForm({ ...investigacionForm, descripcion: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Portada (opcional)</label>
                    <input type="file" accept="image/*" disabled={uploadingPortada} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingPortada(true);
                      try {
                        const { url } = await uploadFile(file);
                        setInvestigacionForm((prev) => ({ ...prev, imagen: url }));
                      } catch { alert('Error al subir portada'); }
                      finally { setUploadingPortada(false); e.target.value = ''; }
                    }} style={{ fontSize: '12px' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PDF (lectura en plataforma)</label>
                    <input type="file" accept=".pdf" disabled={uploadingArchivo} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try { await handleInvestigacionPdfUpload(file); }
                      catch (err) { alert(err instanceof Error ? err.message : 'Error al subir PDF'); }
                      finally { e.target.value = ''; }
                    }} style={{ fontSize: '12px' }} />
                    {investigacionForm.archivo_url && (
                      <FileResourcePreview
                        fileName={investigacionForm.archivo_nombre || 'documento.pdf'}
                        fileUrl={investigacionContenidoUrl(investigacionForm.archivo_url)}
                        localFile={investigacionPdfLocal}
                        maxHeight={240}
                        securePdf
                      />
                    )}
                  </div>
                </div>
              )}

              <div style={styles.modalFooter}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Procesando...' : (crudMode === 'add' ? 'Crear Recurso' : 'Guardar Cambios')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {checkoutBook && (
        <CheckoutModal
          book={checkoutBook}
          onClose={() => setCheckoutBook(null)}
          onSuccess={() => { fetchData(); }}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    paddingBottom: '40px',
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '32px',
    boxShadow: 'var(--shadow-sm)',
    position: 'relative',
    overflow: 'hidden',
  },
  heroLeft: {
    maxWidth: '70%',
  },
  title: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#0073A5',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748B',
    lineHeight: '1.5',
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'rgba(0,115,165,0.06)',
    borderRadius: '20px',
  },
  tabsContainer: {
    display: 'flex',
    gap: '12px',
    borderBottom: '2px solid var(--border)',
    paddingBottom: '8px',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    border: 'none',
    background: 'none',
    fontSize: '14px',
    fontWeight: '700',
    color: '#64748B',
    cursor: 'pointer',
    position: 'relative',
    transition: 'var(--transition)',
  },
  activeTabBtn: {
    color: '#0073A5',
    borderBottom: '3px solid #0073A5',
    marginBottom: '-11px',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#0073A5',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    marginBottom: '20px',
    transition: 'var(--transition)',
  },
  adminCardActions: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    display: 'flex',
    gap: '8px',
    zIndex: 10,
  },
  editCardBtn: {
    backgroundColor: 'rgba(0, 115, 165, 0.1)',
    color: '#0073A5',
    border: 'none',
    borderRadius: '6px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  deleteCardBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#EF4444',
    border: 'none',
    borderRadius: '6px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'var(--transition)',
  },
  magList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  magCard: {
    display: 'flex',
    gap: '32px',
    padding: '32px',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    alignItems: 'center',
    position: 'relative',
  },
  magImageWrapper: {
    width: '180px',
    height: '240px',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    flexShrink: 0,
    backgroundColor: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  magImageSelf: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  magInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  magHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  magTitle: {
    fontSize: '22px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginBottom: '10px',
  },
  magDesc: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    marginBottom: '20px',
  },
  magFeatures: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '20px',
  },
  magFeatureItem: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#0073A5',
  },
  booksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))',
    gap: '24px',
  },
  bookCard: {
    display: 'flex',
    gap: '20px',
    padding: '24px',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  bookImageWrapper: {
    width: '120px',
    height: '170px',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
    flexShrink: 0,
    backgroundColor: '#F1F5F9',
  },
  bookImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  bookInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  bookAuthor: {
    fontSize: '11px',
    fontWeight: '800',
    color: '#B0B3B5',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  bookTitle: {
    fontSize: '18px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: '4px 0 10px 0',
  },
  bookDesc: {
    fontSize: '13px',
    color: '#64748B',
    lineHeight: '1.4',
    marginBottom: '16px',
  },
  bookFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    borderTop: '1px solid var(--border)',
    paddingTop: '12px',
  },
  priceLabel: {
    fontSize: '11px',
    color: '#B0B3B5',
    fontWeight: '700',
  },
  bookPrice: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#0073A5',
  },
  interviewsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '24px',
  },
  interviewCard: {
    padding: '0',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  videoPlaceholderCard: {
    width: '100%',
    height: '200px',
    backgroundColor: '#0F172A',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoIframe: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
  interviewInfo: {
    padding: '20px',
  },
  durationBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: 'rgba(176,179,181,0.15)',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748B',
    marginBottom: '12px',
  },
  interviewTitle: {
    fontSize: '16px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    lineHeight: '1.4',
    marginBottom: '12px',
  },
  expertBlock: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '8px',
    fontSize: '12px',
  },
  interviewDesc: {
    fontSize: '12px',
    color: '#64748B',
    lineHeight: '1.4',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '90%',
    maxWidth: '600px',
    padding: '32px',
    maxHeight: '90vh',
    overflowY: 'auto',
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#64748B',
  },
  modalTitle: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#0073A5',
    marginBottom: '16px',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '12px',
  },
  modalFooter: {
    borderTop: '1px solid var(--border)',
    paddingTop: '20px',
    marginTop: '20px',
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: '#64748B',
    backgroundColor: '#FFFFFF',
    border: '1px dashed var(--border)',
    borderRadius: '12px',
    fontWeight: '600',
  },
  loadingWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '300px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(0, 115, 165, 0.1)',
    borderTop: '4px solid #0073A5',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  }
};
