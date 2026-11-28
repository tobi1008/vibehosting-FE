'use client';

import { useEffect, useState } from 'react';
import { Cpu, Database, FolderGit2, Loader2, MemoryStick, Package as PackageIcon } from 'lucide-react';

type PackageInfo = {
  name: string;
  description: string | null;
  unlimited: boolean;
  maxProjects: number | null;
  cpu: string | null;
  memory: string | null;
  allowDatabase: boolean;
  dbStorage: string | null;
  usedProjects: number;
};

/** Thẻ "Gói của bạn" ở trang hồ sơ: giới hạn của gói hosting và số project đã dùng */
export default function PackageCard() {
  const [info, setInfo] = useState<PackageInfo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/user/package', { cache: 'no-store' })
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

  const full = info && !info.unlimited && info.maxProjects !== null && info.usedProjects >= info.maxProjects;
  const percent =
    info && !info.unlimited && info.maxProjects ? Math.min(100, Math.round((info.usedProjects / info.maxProjects) * 100)) : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <PackageIcon className="w-5 h-5" />
        <h2 className="text-lg font-semibold text-foreground">Gói hosting của bạn</h2>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!info && !error && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
      {info && (
        <>
          <p className="text-base font-semibold text-foreground">{info.name}</p>
          {info.description && <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>}
          {info.unlimited ? (
            <p className="text-sm text-muted-foreground mt-3">Tài khoản admin không bị giới hạn tài nguyên.</p>
          ) : (
            <>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span className="flex items-center gap-1">
                    <FolderGit2 className="w-3.5 h-3.5" /> Project
                  </span>
                  <span className={full ? 'text-red-500 font-semibold' : ''}>
                    {info.usedProjects} / {info.maxProjects}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${full ? 'bg-red-500' : 'bg-foreground'}`} style={{ width: `${percent}%` }} />
                </div>
                {full && (
                  <p className="text-xs text-red-500 mt-2">
                    Đã dùng hết số project của gói. Xóa bớt project hoặc liên hệ admin để nâng gói.
                  </p>
                )}
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-sm">
                <li className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                  <Cpu className="w-4 h-4 text-muted-foreground" /> {info.cpu} CPU
                </li>
                <li className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                  <MemoryStick className="w-4 h-4 text-muted-foreground" /> {info.memory} RAM
                </li>
                <li className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  {info.allowDatabase ? `DB ${info.dbStorage}` : 'Không có DB'}
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3">CPU và RAM tính cho từng container của mỗi app.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
