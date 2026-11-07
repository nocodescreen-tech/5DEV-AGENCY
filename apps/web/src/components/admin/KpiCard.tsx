import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Micro-courbe : dernière série réelle, aucune donnée inventée. */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 74;
  const h = 26;
  const max = Math.max(1, ...values);
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`);
  const area = `M0,${h} L${pts.join(' L')} L${w},${h} Z`;
  return (
    <svg className="kpi-spark" viewBox={`0 0 ${w} ${h}`} aria-hidden preserveAspectRatio="none">
      <path d={area} fill="url(#kpi-fill)" />
      <polyline points={pts.join(' ')} fill="none" stroke="var(--brand)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <defs>
        <linearGradient id="kpi-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Carte d'indicateur de la console. Une seule valeur mise en avant, une tendance
 * chiffrée quand elle existe, une micro-courbe sur les données réelles.
 */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  to,
  tone,
  alert,
  trend,
  series,
  delay = 0,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  to: string;
  tone?: 'brand';
  alert?: boolean;
  trend?: number | null;
  series?: number[];
  delay?: number;
}) {
  return (
    <Link
      to={to}
      className="kpi group"
      style={{ animation: `row-in .45s cubic-bezier(.22,1,.36,1) ${delay}ms both` }}
    >
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <Icon className="kpi-icon size-4 transition-colors" aria-hidden />
      </div>
      <p className="kpi-value" style={tone === 'brand' ? { color: 'var(--brand)' } : undefined}>
        {value}
      </p>
      <div className="kpi-foot">
        <div>
          <p className="kpi-hint" style={alert ? { color: 'var(--brand)', fontWeight: 600 } : undefined}>
            {hint}
          </p>
          {typeof trend === 'number' && (
            <span className={`kpi-trend mt-1.5 ${trend < 0 ? 'is-down' : ''}`}>
              {trend >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(trend)} % · 7 j
            </span>
          )}
        </div>
        {series && <Spark values={series} />}
      </div>
    </Link>
  );
}
