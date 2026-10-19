'use client';

import { useState } from 'react';
import { Compass, Layers, Network, Shield, Gauge, Zap, ArrowRight } from 'lucide-react';
import styles from './LearningOverview.module.css';

const METHODS = [
  {
    id: 'lean',
    label: 'Lean',
    subtitle: 'Avanza con menos desperdicio',
    icon: Zap,
    description:
      'Valida hipótesis con productos mínimos viables y acelera el desarrollo sin invertir recursos antes de tiempo.',
  },
  {
    id: 'agile',
    label: 'Agile',
    subtitle: 'Adáptate con cada iteración',
    icon: Gauge,
    description:
      'Trabaja con ciclos cortos, retroalimentación continua y equipos autónomos que adaptan el producto al mercado real.',
  },
  {
    id: 'stage',
    label: 'Stage-Gate',
    subtitle: 'Decide con mayor control',
    icon: Shield,
    description:
      'Organiza el proyecto en fases con puntos de decisión para gestionar el riesgo y reducir el costo de los errores.',
  },
];

export default function AreasDominio({ compact = false }: { compact?: boolean }) {
  const [selectedMethod, setSelectedMethod] = useState('lean');
  const method = METHODS.find((item) => item.id === selectedMethod) ?? METHODS[0];
  const MethodIcon = method.icon;

  return (
    <section
      id="modulos"
      className={`${styles.program} ${compact ? styles.compact : ''}`}
      aria-labelledby="programa-title"
    >
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>EL PROGRAMA</span>
          <h2 id="programa-title">
            De la empatía a la
            <br />
            disrupción estratégica.
          </h2>
        </div>
        <p>
          Un recorrido por tres áreas de dominio.
          <br />
          Explora las herramientas de cada etapa.
        </p>
      </div>
      <div className={styles.programGrid}>
        <article className={`${styles.programCard} ${styles.discoveryCard}`}>
          <div className={styles.cardTop}>
            <span className={styles.moduleIcon}>
              <Compass size={25} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span className={styles.moduleNumber} aria-hidden="true">
              01
            </span>
          </div>
          <span className={styles.cardEyebrow}>ENTIENDE EL PROBLEMA</span>
          <h3>Descubrimiento</h3>
          <p>
            Acércate a tus usuarios. Investiga, entrevista y crea prototipos para descubrir
            necesidades reales antes de construir.
          </p>
          <div className={styles.chips}>
            <span>Design Thinking</span>
            <span>Jobs To Be Done</span>
            <span>Entrevistas</span>
          </div>
          <div className={styles.cardOutcome}>
            <ArrowRight size={16} aria-hidden="true" />
            <span>Encuentra oportunidades con sentido.</span>
          </div>
        </article>
        <article className={styles.programCard}>
          <div className={styles.cardTop}>
            <span className={styles.moduleIcon}>
              <Layers size={25} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span className={styles.moduleNumber} aria-hidden="true">
              02
            </span>
          </div>
          <span className={styles.cardEyebrow}>LLEVA LAS IDEAS A LA PRÁCTICA</span>
          <h3>Ejecución</h3>
          <div
            className={styles.methodPicker}
            role="group"
            aria-label="Explorar metodologías de ejecución"
          >
            {METHODS.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={selectedMethod === item.id}
                onClick={() => setSelectedMethod(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={styles.methodDescription} aria-live="polite" aria-atomic="true">
            <span>
              <MethodIcon size={16} aria-hidden="true" />
              {method.subtitle}
            </span>
            <p>{method.description}</p>
          </div>
          <div className={styles.cardOutcome}>
            <ArrowRight size={16} aria-hidden="true" />
            <span>Convierte la estrategia en resultados.</span>
          </div>
        </article>
        <article className={`${styles.programCard} ${styles.disruptionCard}`}>
          <div className={styles.cardTop}>
            <span className={styles.moduleIcon}>
              <Network size={25} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span className={styles.moduleNumber} aria-hidden="true">
              03
            </span>
          </div>
          <span className={styles.cardEyebrow}>AMPLÍA LAS POSIBILIDADES</span>
          <h3>Disrupción</h3>
          <p>
            Conecta capacidades, crea plataformas y explora los modelos que permiten a las empresas
            transformar sus mercados.
          </p>
          <div className={styles.chips}>
            <span>Open Innovation</span>
            <span>Plataformas</span>
            <span>Economía Exponencial</span>
          </div>
          <div className={styles.cardOutcome}>
            <ArrowRight size={16} aria-hidden="true" />
            <span>Diseña tu siguiente ventaja estratégica.</span>
          </div>
        </article>
      </div>
    </section>
  );
}
