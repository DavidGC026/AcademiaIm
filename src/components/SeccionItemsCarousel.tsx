'use client';

import { useCallback, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { withAlpha } from '@/lib/colorUtils';

interface Props {
  accentColor: string;
  children: React.ReactNode[];
  /** Altura máxima del área deslizable (evita desborde vertical). */
  maxHeight?: number;
}

export default function SeccionItemsCarousel({ accentColor, children, maxHeight }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const total = children.length;

  const syncActiveFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || total === 0) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let closest = 0;
    let minDist = Infinity;
    Array.from(track.children).forEach((el, i) => {
      const slide = el as HTMLElement;
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const dist = Math.abs(center - slideCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    setActive(closest);
  }, [total]);

  const goTo = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(total - 1, index));
      setActive(next);
      const track = trackRef.current;
      const slide = track?.children[next] as HTMLElement | undefined;
      slide?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    },
    [total]
  );

  if (total === 0) return null;
  if (total === 1) {
    return <div style={{ minWidth: 0 }}>{children[0]}</div>;
  }

  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>
          Recurso {active + 1} de {total}
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            disabled={active === 0}
            aria-label="Recurso anterior"
            style={navBtn(accentColor, active === 0)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            disabled={active === total - 1}
            aria-label="Siguiente recurso"
            style={navBtn(accentColor, active === total - 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <div
          ref={trackRef}
          onScroll={syncActiveFromScroll}
          style={{
            display: 'flex',
            gap: '14px',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollSnapType: 'x mandatory',
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: '4px',
            maxHeight: maxHeight ? maxHeight + 8 : undefined,
            scrollbarWidth: 'thin',
          }}
        >
          {children.map((child, i) => (
            <div
              key={i}
              style={{
                flex: '0 0 min(100%, 520px)',
                scrollSnapAlign: 'center',
                minWidth: 0,
                maxHeight,
                overflow: 'auto',
              }}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
        {children.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Ir al recurso ${i + 1}`}
            style={{
              width: i === active ? '22px' : '8px',
              height: '8px',
              borderRadius: '999px',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              backgroundColor: i === active ? accentColor : withAlpha(accentColor, 0.25),
              transition: 'width 0.2s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function navBtn(color: string, disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    border: `1px solid ${withAlpha(color, disabled ? 0.15 : 0.35)}`,
    backgroundColor: disabled ? '#F1F5F9' : withAlpha(color, 0.1),
    color: disabled ? '#94A3B8' : color,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
