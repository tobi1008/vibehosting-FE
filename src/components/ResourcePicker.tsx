'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Cpu, Database, Loader2, MemoryStick, SlidersHorizontal } from 'lucide-react';
import {
  type Allocation,
  MIN_CPU_PER_PART,
  MIN_MEMORY_PER_PART,
  RESOURCE_PRESETS,
} from '@/lib/resources';
import { formatCpu, formatMi } from '@/lib/format';

type Summary = {
  package: { name: string; unlimited: boolean; allowDatabase: boolean };
  total: Allocation | null;
  allocated: Allocation;
  remaining: Allocation | null;
  apps: Record<string, Allocation & { parts: number }>;
};

/**
 * Chọn CPU/RAM/dung lượng database cho một app trong phần còn lại của gói hosting.
 * - Tạo project: summarySource = '/api/user/allocation'.
 * - Đổi tài nguyên project đang chạy: summarySource = '/api/projects/<app>/resources', app = tên app
 *   (phần của chính app được cộng trả lại vào "còn lại").
 * onValidity báo cho form cha biết lựa chọn có hợp lệ để cho phép bấm triển khai/lưu.
 */
export default function ResourcePicker({
  parts,
  hasDatabase,
  value,
  onChange,
  onValidity,
  app,
  summarySource = '/api/user/allocation',
  minDbStorageGi = 1,
}: {
  parts: number;
  hasDatabase: boolean;
  value: Allocation;
  onChange: (v: Allocation) => void;
  onValidity?: (valid: boolean) => void;
  app?: string;
  summarySource?: string;
  minDbStorageGi?: number;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState('');
  const [custom, setCustom] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(summarySource, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!active) return;
        if (r.ok) setSummary(d);
        else setLoadError(d?.error || 'Không tải được tài nguyên của gói');
      })
      .catch(() => active && setLoadError('Không tải được tài nguyên của gói'));
    return () => {
      active = false;
    };
  }, [summarySource]);

  // Phần còn lại dành cho app này (khi sửa app đang chạy: cộng trả phần đang giữ của chính nó)
  const available = useMemo<Allocation | null>(() => {
    if (!summary?.remaining) return null;
    const own = app ? summary.apps[app] : undefined;
    return {
      cpuMillicores: summary.remaining.cpuMillicores + (own?.cpuMillicores || 0),
      memoryMi: summary.remaining.memoryMi + (own?.memoryMi || 0),
      dbStorageGi: summary.remaining.dbStorageGi + (own?.dbStorageGi || 0),
    };
  }, [summary, app]);

  const minCpu = parts * MIN_CPU_PER_PART;
  const minMem = parts * MIN_MEMORY_PER_PART;
  const problems: string[] = [];
  if (value.cpuMillicores < minCpu) problems.push(`CPU tối thiểu ${minCpu}m cho ${parts} thành phần`);
  if (value.memoryMi < minMem) problems.push(`RAM tối thiểu ${minMem} MiB cho ${parts} thành phần`);
  if (hasDatabase && value.dbStorageGi < minDbStorageGi) problems.push(`Database tối thiểu ${minDbStorageGi} GiB`);
  if (available) {
    if (value.cpuMillicores > available.cpuMillicores) problems.push(`CPU chỉ còn ${formatCpu(available.cpuMillicores)}`);
    if (value.memoryMi > available.memoryMi) problems.push(`RAM chỉ còn ${formatMi(available.memoryMi)}`);
    if (hasDatabase && value.dbStorageGi > available.dbStorageGi) {
      problems.push(available.dbStorageGi ? `Database chỉ còn ${available.dbStorageGi} GiB` : 'Gói đã hết dung lượng database');
    }
  }
  if (hasDatabase && summary && !summary.package.allowDatabase) problems.push('Gói của bạn không bao gồm database');
  const valid = problems.length === 0 && !loadError;

  useEffect(() => {
    onValidity?.(valid);
  }, [valid, onValidity]);

  const fits = (p: { cpuMillicores: number; memoryMi: number }) =>
    p.cpuMillicores >= minCpu &&
    p.memoryMi >= minMem &&
    (!available || (p.cpuMillicores <= available.cpuMillicores && p.memoryMi <= available.memoryMi));

  const activePreset = RESOURCE_PRESETS.find(
    (p) => p.cpuMillicores === value.cpuMillicores && p.memoryMi === value.memoryMi,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-semibold text-foreground flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" /> Tài nguyên cho ứng dụng
        </span>
        {summary && (
          <span className="text-xs text-muted-foreground">
            {summary.package.unlimited ? (
              'Admin: không giới hạn'
            ) : available ? (
              <>
                Gói {summary.package.name} còn {formatCpu(available.cpuMillicores)} CPU · {formatMi(available.memoryMi)} RAM
                {summary.package.allowDatabase ? ` · ${available.dbStorageGi} GiB DB` : ''}
              </>
            ) : null}
          </span>
        )}
      </div>

      {!summary && !loadError ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {RESOURCE_PRESETS.map((p) => {
              const ok = fits(p);
              const selected = !custom && activePreset?.id === p.id;
              return (
                <button
                  type="button"
                  key={p.id}
                  disabled={!ok}
                  onClick={() => {
                    setCustom(false);
                    onChange({ ...value, cpuMillicores: p.cpuMillicores, memoryMi: p.memoryMi });
                  }}
                  className={`text-left rounded-lg border px-3 py-2 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    selected ? 'border-foreground bg-foreground/5 ring-1 ring-foreground/30' : 'border-border hover:bg-muted'
                  }`}
                >
                  <span className="block font-semibold text-sm text-foreground">{p.label}</span>
                  <span className="text-muted-foreground">
                    {formatCpu(p.cpuMillicores)} · {formatMi(p.memoryMi)}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCustom(true)}
              className={`text-left rounded-lg border px-3 py-2 text-xs ${
                custom || !activePreset ? 'border-foreground bg-foreground/5 ring-1 ring-foreground/30' : 'border-border hover:bg-muted'
              }`}
            >
              <span className="block font-semibold text-sm text-foreground">Tùy chỉnh</span>
              <span className="text-muted-foreground">Tự nhập CPU/RAM</span>
            </button>
          </div>

          {(custom || !activePreset) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5" /> CPU (millicore, 1000 = 1 vCPU)
                </span>
                <input
                  type="number"
                  min={minCpu}
                  step={50}
                  value={value.cpuMillicores}
                  onChange={(e) => onChange({ ...value, cpuMillicores: Number(e.target.value) })}
                  className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-foreground"
                />
              </label>
              <label className="block text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <MemoryStick className="w-3.5 h-3.5" /> RAM (MiB, 1024 = 1 GiB)
                </span>
                <input
                  type="number"
                  min={minMem}
                  step={64}
                  value={value.memoryMi}
                  onChange={(e) => onChange({ ...value, memoryMi: Number(e.target.value) })}
                  className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-foreground"
                />
              </label>
            </div>
          )}

          {hasDatabase && (
            <label className="block text-xs max-w-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Database className="w-3.5 h-3.5" /> Dung lượng database (GiB)
              </span>
              <input
                type="number"
                min={minDbStorageGi}
                step={1}
                value={value.dbStorageGi}
                onChange={(e) => onChange({ ...value, dbStorageGi: Number(e.target.value) })}
                className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-foreground"
              />
              {minDbStorageGi > 1 && (
                <span className="text-[11px] text-muted-foreground">Ổ database đã cấp không thu nhỏ được.</span>
              )}
            </label>
          )}

          {parts > 1 && (
            <p className="text-[11px] text-muted-foreground">
              App có {parts} thành phần ({hasDatabase ? 'gồm database, ' : ''}chia đều): mỗi thành phần nhận khoảng{' '}
              {formatCpu(Math.floor(value.cpuMillicores / parts))} CPU và {formatMi(Math.floor(value.memoryMi / parts))} RAM.
            </p>
          )}

          {(problems.length > 0 || loadError) && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs px-3 py-2 rounded-md flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {loadError || problems.join(' · ')}
                {!loadError && available && (
                  <>
                    {' '}
                    — giảm mức của app khác ở tab Cài đặt hoặc{' '}
                    <Link href="/usage" className="underline">
                      xem Usage
                    </Link>
                    .
                  </>
                )}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
