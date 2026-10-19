export const SLOGAN = 'Construyendo sistemas de innovación consistentes';

export const PILARES = [
  {
    id: 'estrategia',
    title: 'Estrategia de Alto Nivel',
    description:
      'Cómo las Big Tech (Apple, Amazon, Tesla) no dependen de una sola fórmula, sino que integran ecosistemas multi-modelo complejos para dominar mercados.',
    icon: 'strategy' as const,
  },
  {
    id: 'validacion',
    title: 'Validación y Centricidad en el Usuario',
    description:
      'Metodologías para entender la necesidad real del mercado antes de tirar una sola línea de código o invertir recursos.',
    icon: 'users' as const,
  },
  {
    id: 'operativos',
    title: 'Marcos Operativos de Desarrollo',
    description:
      'Cómo gestionar el ciclo de vida de un producto combinando velocidad (Lean), flexibilidad (Agile) y control de riesgos (Stage-Gate).',
    icon: 'layers' as const,
  },
];

export type Industria = 'Tecnología' | 'Manufactura' | 'Retail' | 'Servicios' | 'Energía';

export const INDUSTRIAS: Industria[] = [
  'Tecnología',
  'Manufactura',
  'Retail',
  'Servicios',
  'Energía',
];

/** ponytail: adopción estática por industria; sin backend */
export const ADOPCION_POR_INDUSTRIA: Record<
  Industria,
  { metodo: string; nivel: 'alta' | 'media' | 'baja'; pct: number }[]
> = {
  Tecnología: [
    { metodo: 'Agile / Scrum', nivel: 'alta', pct: 92 },
    { metodo: 'Design Thinking', nivel: 'alta', pct: 88 },
    { metodo: 'Lean Startup', nivel: 'alta', pct: 85 },
    { metodo: 'Stage-Gate', nivel: 'media', pct: 55 },
    { metodo: 'Open Innovation', nivel: 'media', pct: 62 },
  ],
  Manufactura: [
    { metodo: 'Stage-Gate', nivel: 'alta', pct: 90 },
    { metodo: 'Lean Manufacturing', nivel: 'alta', pct: 87 },
    { metodo: 'Six Sigma', nivel: 'media', pct: 72 },
    { metodo: 'Agile', nivel: 'media', pct: 48 },
    { metodo: 'Design Thinking', nivel: 'baja', pct: 35 },
  ],
  Retail: [
    { metodo: 'Customer Centricity (JTBD)', nivel: 'alta', pct: 91 },
    { metodo: 'Lean', nivel: 'alta', pct: 78 },
    { metodo: 'Agile Merchandising', nivel: 'media', pct: 65 },
    { metodo: 'Plataformas Digitales', nivel: 'media', pct: 70 },
    { metodo: 'Stage-Gate', nivel: 'baja', pct: 40 },
  ],
  Servicios: [
    { metodo: 'Design Thinking', nivel: 'alta', pct: 86 },
    { metodo: 'Agile', nivel: 'alta', pct: 82 },
    { metodo: 'Lean Service', nivel: 'media', pct: 68 },
    { metodo: 'JTBD', nivel: 'media', pct: 74 },
    { metodo: 'Stage-Gate', nivel: 'baja', pct: 38 },
  ],
  Energía: [
    { metodo: 'Stage-Gate', nivel: 'alta', pct: 88 },
    { metodo: 'Open Innovation', nivel: 'alta', pct: 80 },
    { metodo: 'Lean', nivel: 'media', pct: 58 },
    { metodo: 'Agile', nivel: 'media', pct: 52 },
    { metodo: 'Plataformas', nivel: 'baja', pct: 42 },
  ],
};

export const MODELOS_INNOVACION = [
  { id: 'design', label: 'Design Thinking', short: 'Empatía' },
  { id: 'jtbd', label: 'Jobs To Be Done', short: 'Validación' },
  { id: 'lean', label: 'Lean', short: 'Velocidad' },
  { id: 'agile', label: 'Agile', short: 'Flexibilidad' },
  { id: 'stage', label: 'Stage-Gate', short: 'Control' },
  { id: 'open', label: 'Open Innovation', short: 'Ecosistema' },
  { id: 'platform', label: 'Plataformas', short: 'Red' },
  { id: 'exponential', label: 'Econ. Exponencial', short: 'Escala' },
];

export type EmpresaId = 'apple' | 'google' | 'tesla' | 'amazon';

export const EMPRESAS: {
  id: EmpresaId;
  name: string;
  color: string;
  modelos: string[];
}[] = [
  {
    id: 'apple',
    name: 'Apple',
    color: '#A2AAAD',
    modelos: ['design', 'platform', 'stage', 'exponential'],
  },
  {
    id: 'google',
    name: 'Google',
    color: '#4285F4',
    modelos: ['open', 'platform', 'agile', 'jtbd'],
  },
  {
    id: 'tesla',
    name: 'Tesla',
    color: '#CC0000',
    modelos: ['exponential', 'lean', 'agile', 'open'],
  },
  {
    id: 'amazon',
    name: 'Amazon',
    color: '#FF9900',
    modelos: ['jtbd', 'lean', 'platform', 'agile'],
  },
];

export const MAESTRO = {
  nombre: 'Ing. Roberto Uribe Afif',
  titulo: 'Director del Programa · Experto en Innovación Empresarial',
  bio: [
    'Ingeniero Geólogo egresado de la UNAM.',
    'Maestría en Ingeniería con especialidad en exploración de recursos energéticos.',
    'Experiencia en CFE (8 años) y CEMEX México como Director Técnico para Latinoamérica.',
    'Director General del IMCYC y docente certificado CONOCER (EC-0217 / EC-0301).',
  ],
};
