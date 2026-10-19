'use client';

import { useState } from 'react';
import { Check, Minus, Network, ArrowUpRight } from 'lucide-react';
import { EMPRESAS, MODELOS_INNOVACION, type EmpresaId } from '@/lib/innovacion-data';
import styles from './LearningOverview.module.css';

export default function EcosistemaHibrido({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState<EmpresaId>('apple');
  const company = EMPRESAS.find((item) => item.id === selected) ?? EMPRESAS[0];

  return (
    <section
      id="ecosistema"
      className={compact ? styles.compact : undefined}
      aria-labelledby="ecosistema-title"
    >
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>CASOS DE ESTUDIO</span>
          <h2 id="ecosistema-title">
            La fuerza está
            <br />
            en la combinación.
          </h2>
        </div>
        <p>
          Explora cómo se conectan los modelos de innovación en los casos del diplomado. Selecciona
          una empresa para comenzar.
        </p>
      </div>
      <div className={styles.ecosystemPanel}>
        <div className={styles.companyPicker} role="group" aria-label="Seleccionar empresa">
          {EMPRESAS.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={selected === item.id}
              onClick={() => setSelected(item.id)}
            >
              {item.name}
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className={styles.ecosystemContent}>
          <div className={styles.companySummary}>
            <span className={styles.networkIcon}>
              <Network size={28} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className={styles.cardEyebrow}>ECOSISTEMA HÍBRIDO</span>
            <h3>{company.name}</h3>
            <p aria-live="polite" aria-atomic="true">
              <strong>{company.modelos.length} modelos conectados</strong>
              <br />
              en el caso de {company.name}.
            </p>
            <div className={styles.modelLegend}>
              <Check size={14} aria-hidden="true" />
              <span>Modelos incluidos en este caso</span>
            </div>
          </div>
          <ul className={styles.modelGrid} aria-label={`Modelos de innovación de ${company.name}`}>
            {MODELOS_INNOVACION.map((model) => {
              const active = company.modelos.includes(model.id);
              return (
                <li
                  key={model.id}
                  className={`${styles.modelItem} ${active ? styles.modelActive : ''}`}
                >
                  <span>
                    <small>{model.short}</small>
                    <strong>{model.label}</strong>
                  </span>
                  {active ? (
                    <Check size={18} aria-label="Incluido" />
                  ) : (
                    <Minus size={16} aria-label="No incluido" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <p className={styles.ecosystemNote}>
          Mapa conceptual del diplomado · Un mismo reto puede abordarse desde varios modelos.
        </p>
      </div>
    </section>
  );
}
