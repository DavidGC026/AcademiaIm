const HEX3 = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;
const HEX6 = /^#([0-9a-fA-F]{6})$/;
const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)$/;

/** Acepta #RGB, #RRGGBB o rgb(r,g,b). Devuelve null si es inválido. */
export function parseCssColor(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const s = input.trim();
  const h3 = s.match(HEX3);
  if (h3) {
    const [, r, g, b] = h3;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (HEX6.test(s)) return s.toLowerCase();
  const rgb = s.match(RGB);
  if (rgb) {
    const nums = [rgb[1], rgb[2], rgb[3]].map(Number);
    if (nums.every((n) => n >= 0 && n <= 255)) {
      return `rgb(${nums[0]}, ${nums[1]}, ${nums[2]})`;
    }
  }
  return null;
}

export function resolveColor(
  input: string | null | undefined,
  fallback = '#0073A5'
): string {
  return parseCssColor(input) ?? fallback;
}

function colorToRgb(color: string): [number, number, number] | null {
  const parsed = parseCssColor(color);
  if (!parsed) return null;
  if (parsed.startsWith('#')) {
    const h = parsed.slice(1);
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  const m = parsed.match(RGB);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function withAlpha(color: string, alpha: number): string {
  const rgb = colorToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/** Para `<input type="color">` — solo si el valor es hex. */
export function toColorPickerValue(color: string | null | undefined): string {
  const parsed = parseCssColor(color);
  return parsed?.startsWith('#') ? parsed : '#0073a5';
}

if (process.env.NODE_ENV === 'development') {
  const ok =
    parseCssColor('#F00') === '#ff0000' &&
    parseCssColor('rgb(10, 20, 30)') === 'rgb(10, 20, 30)' &&
    parseCssColor('invalid') === null;
  if (!ok) console.warn('colorUtils: self-check failed');
}
