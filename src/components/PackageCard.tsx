'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cpu, Database, FolderGit2, Loader2, MemoryStick, Package as PackageIcon } from 'lucide-react';
import UsageBar from '@/components/UsageBar';
import { formatCpu, formatMi } from '@/lib/format';
import type { Allocation } from '@/lib/resources';

type Summary = {
  package: {
    name: string;
    description: string | null;
    unlimited: boolean;
    maxProjects: number | null;
    allowDatabase: boolean;
  };
  total: Allocation | null;
  allocated: Allocation;
  usedProjects: number;
};

/** Thẻ "Gói của bạn" ở trang hồ sơ: tổng tài nguyên của gói và phần đã phân bổ cho các project */
export default function PackageCard() {
  const [info, setInfo] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/user/allocation', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!active) return;
        if (res.ok) setInfo(data);
        else setError(data?.error || 'Không tải được gói hosting');
      })
      .catch(() => active && setError('Không tải được gói hosting'));
    return () => {
      active = false;
    };
  }, []);

  const pkg = info?.package;
  const rows =
    info && info.total
      ? [
          {
            icon: <FolderGit2 className="w-3.5 h-3.5" />,
            label: 'Project',
            used: info.usedProjects,
            total: pkg?.maxProjects || 0,
            text: `${info.usedProjects} / ${pkg?.maxProjects}`,
          },
          {
            icon: <Cpu className="w-3.5 h-3.5" />,
            label: 'CPU đã phân bổ',
            used: info.allocated.cpuMillicores,
            total: info.total.cpuMillicores,
            text: `${formatCpu(info.allocated.cpuMillicores)} / ${formatCpu(info.total.cpuMillicores)}`,
          },
          {
            icon: <MemoryStick className="w-3.5 h-3.5" />,
            label: 'RAM đã phân bổ',
            used: info.allocated.memoryMi,
            total: info.total.memoryMi,
            text: `${formatMi(info.allocated.memoryMi)} / ${formatMi(info.total.memoryMi)}`,
          },
          ...(pkg?.allowDatabase
            ? [
                {
                  icon: <Database className="w-3.5 h-3.5" />,
                  label: 'Database đã phân bổ',
                  used: info.allocated.dbStorageGi,
                  total: info.total.dbStorageGi,
                  text: `${info.allocated.dbStorageGi} / ${info.total.dbStorageGi} GiB`,
                },
              ]
            : []),
        ]
      : [];

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <PackageIcon className="w-5 h-5" />
          <h2 className="text-lg font-semibold text-foreground">Gói hosting của bạn</h2>
        </div>
        <Link href="/usage" className="text-xs text-muted-foreground hover:underline">
          Xem Usage
        </Link>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!info && !error && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
      {info && pkg && (
        <>
          <p className="text-base font-semibold text-foreground">{pkg.name}</p>
          {pkg.description && <p className="text-xs text-muted-foreground mt-0.5">{pkg.description}</p>}
          {pkg.unlimited ? (
            <p className="text-sm text-muted-foreground mt-3">Tài khoản admin không bị giới hạn tài nguyên.</p>
          ) : (
            <>
              <div className="mt-4 space-y-3">
                {rows.map((r) => (
                  <div key={r.label}>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span className="flex items-center gap-1">
                        {r.icon} {r.label}
                      </span>
                      <span className="font-mono">{r.text}</span>
                    </div>
                    <UsageBar used={r.used} total={r.total} label={r.label} />
                  </div>
                ))}
              </div>
              {!pkg.allowDatabase && <p className="text-xs text-muted-foreground mt-3">Gói không bao gồm database.</p>}
              <p className="text-xs text-muted-foreground mt-3">
                Gói là tổng tài nguyên cho mọi project. Chọn mức cho từng project khi tạo, đổi ở tab Cài đặt của project.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
