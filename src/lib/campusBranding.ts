/** Both campuses share the learning experience while keeping their program identity. */
export const isInnovationCampus = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '') === '/ruadiplo';

export const campusBranding = isInnovationCampus ? {
  id: 'innovacion',
  name: 'Modelos de Innovación',
  subtitle: 'Empresas Líderes Globales',
  title: 'Modelos de Innovación · Empresas Líderes Globales',
  description: 'Plataforma educativa para dominar los sistemas de innovación de las empresas líderes globales.',
  slogan: 'Construyendo sistemas de innovación consistentes',
  learningDescription: 'Accede a tus clases, materiales y evaluaciones del diplomado.',
  aboutLabel: 'Acerca del diplomado',
  storageKey: 'ruadiplo-sidebar-collapsed',
} : {
  id: 'academia',
  name: 'Academia IMCYC',
  subtitle: 'Cemento y concreto',
  title: 'Academia IMCYC · Cemento y concreto',
  description: 'Plataforma educativa para profesionales de la construcción y la industria del concreto.',
  slogan: 'Conocimiento para construir mejor',
  learningDescription: 'Accede a tus clases, materiales y evaluaciones de la Academia IMCYC.',
  aboutLabel: 'Acerca de la Academia',
  storageKey: 'academia-sidebar-collapsed',
};
