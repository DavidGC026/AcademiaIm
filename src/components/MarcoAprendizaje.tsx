'use client';

import IndustriaAdopcion from '@/components/IndustriaAdopcion';
import AreasDominio from '@/components/AreasDominio';
import EcosistemaHibrido from '@/components/EcosistemaHibrido';

/** Bloque pesado del marco pedagógico; cargar solo bajo demanda (dynamic import). */
export default function MarcoAprendizaje() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <IndustriaAdopcion compact />
      <AreasDominio compact />
      <EcosistemaHibrido compact />
    </div>
  );
}
