import { percent } from '@/lib/format';

/** Thanh dùng/giới hạn: xanh < 70%, vàng < 90%, đỏ từ 90% */
export default function UsageBar({ used, total, label }: { used: number; total: number; label?: string }) {
  const p = percent(used, total);
  const color = !total ? 'bg-muted-foreground/40' : p >= 90 ? 'bg-red-500' : p >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="w-full" title={label}>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full ${color}`} style={{ width: `${total ? Math.max(p, used > 0 ? 2 : 0) : 0}%` }} />
      </div>
    </div>
  );
}
