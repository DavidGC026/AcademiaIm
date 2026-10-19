'use client';

import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { ADOPCION_POR_INDUSTRIA, INDUSTRIAS, type Industria } from '@/lib/innovacion-data';
import styles from './LearningOverview.module.css';

export default function IndustriaAdopcion({ compact = false }: { compact?: boolean }) {
  const [industry, setIndustry] = useState<Industria>('Tecnología');

  return (
    <section
      className={`${styles.industryPanel} ${compact ? styles.compact : ''}`}
      aria-label="Comparación didáctica de metodologías por industria"
    >
      <div className={styles.industryHeading}>
        <h3>
          <BarChart3 size={19} aria-hidden="true" /> Metodologías por sector
        </h3>
        <select
          className="form-select"
          value={industry}
          onChange={(event) => setIndustry(event.target.value as Industria)}
          aria-label="Filtrar por industria"
        >
          {INDUSTRIAS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className={styles.industryBars}>
        {ADOPCION_POR_INDUSTRIA[industry].map((item) => (
          <div key={item.metodo} className={styles.industryRow}>
            <div>
              <span>{item.metodo}</span>
              <span>
                {item.pct}% <small>· {item.nivel}</small>
              </span>
            </div>
            <div className={styles.barTrack} aria-hidden="true">
              <div className={styles[`bar_${item.nivel}`]} style={{ width: `${item.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className={styles.industryNote}>
        Referencia didáctica del programa. Los porcentajes son ilustrativos, no estadísticas de
        mercado.
      </p>
    </section>
  );
}
