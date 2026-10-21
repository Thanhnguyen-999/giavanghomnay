import { useId, useState } from 'react';
import { formatVnd } from './ui.tsx';

export interface TrendPoint {
  /// unix giây hoặc timestamp sắp xếp tăng dần.
  t: number;
  /// giá trị (đồng/lượng).
  v: number;
  /// nhãn hiển thị trên trục/tooltip.
  label: string;
}

interface Props {
  series: TrendPoint[];
  height?: number;
  /// Màu đường. Mặc định theo biến --primary.
  color?: string;
}

/// Line chart SVG thuần cho lịch sử giá theo thời gian.
/// Hover hiện giá trị + ngày; keyboard-focusable điểm; không cần thư viện ngoài.
export function TrendChart({ series, height = 220, color }: Props) {
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (series.length < 2) {
    return (
      <div className="center-pad muted" style={{ height }}>
        Cần ít nhất 2 điểm dữ liệu để vẽ biểu đồ.
      </div>
    );
  }

  const W = 800;
  const H = height;
  const padL = 64;
  const padR = 16;
  const padT = 16;
  const padB = 28;

  const xs = series.map((p) => p.t);
  const vs = series.map((p) => p.v);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minV = Math.min(...vs);
  const maxV = Math.max(...vs);
  const padV = (maxV - minV) * 0.12 || 1;
  const lo = minV - padV;
  const hi = maxV + padV;

  const x = (t: number) => padL + ((t - minX) / (maxX - minX || 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB);

  const line = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(maxX).toFixed(1)},${y(lo).toFixed(1)} L${x(minX).toFixed(1)},${y(lo).toFixed(1)} Z`;

  // 4 mốc trục Y
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + (hi - lo) * f);
  const stroke = color ?? 'var(--primary)';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="img"
      aria-label={`Biểu đồ giá từ ${series[0]!.label} đến ${series[series.length - 1]!.label}`}
      style={{ display: 'block' }}
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* lưới ngang + nhãn trục Y */}
      {ticks.map((tv, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(tv)}
            y2={y(tv)}
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
          <text x={padL - 8} y={y(tv) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" fontFamily="var(--font-mono)">
            {abbr(tv)}
          </text>
        </g>
      ))}

      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />

      {/* điểm + vùng hover */}
      {series.map((p, i) => (
        <circle
          key={i}
          cx={x(p.t)}
          cy={y(p.v)}
          r={hover === i ? 4 : 0}
          fill={stroke}
          stroke="var(--card)"
          strokeWidth="2"
        />
      ))}
      {series.map((p, i) => (
        <rect
          key={`h${i}`}
          x={x(p.t) - (W - padL - padR) / series.length / 2}
          y={padT}
          width={(W - padL - padR) / series.length}
          height={H - padT - padB}
          fill="transparent"
          onMouseEnter={() => setHover(i)}
          tabIndex={0}
          onFocus={() => setHover(i)}
        >
          <title>{`${p.label}: ${formatVnd(p.v)} đ`}</title>
        </rect>
      ))}

      {/* tooltip */}
      {hover != null && (
        <g pointerEvents="none">
          <line
            x1={x(series[hover]!.t)}
            x2={x(series[hover]!.t)}
            y1={padT}
            y2={H - padB}
            stroke="var(--border-strong)"
          />
          <g transform={`translate(${Math.min(x(series[hover]!.t) + 8, W - 150)}, ${padT + 8})`}>
            <rect width="142" height="40" rx="6" fill="var(--bg-elevated)" stroke="var(--border-strong)" />
            <text x="8" y="16" fontSize="11" fill="var(--muted)">
              {series[hover]!.label}
            </text>
            <text x="8" y="32" fontSize="13" fontWeight="600" fill="var(--fg)" fontFamily="var(--font-mono)">
              {formatVnd(series[hover]!.v)} đ
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}

function abbr(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}T`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}tr`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}k`;
  return String(Math.round(v));
}
