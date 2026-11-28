'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import ResourcePicker from '@/components/ResourcePicker';
import type { Allocation } from '@/lib/resources';

type Info = { current: (Allocation & { parts: number }) | null; parts: number; hasDatabase: boolean };

/** Tab Cài đặt của project: đổi CPU/RAM (và tăng dung lượng database) trong phần còn lại của gói, áp ngay lên app */
export default function ProjectResourcesCard({ appName }: { appName: string }) {
  const source = `/api/projects/${encodeURIComponent(appName)}/resources`;
  const [info, setInfo] = useState<Info | null>(null);
  const [value, setValue] = useState<Allocation>({ cpuMillicores: 250, memoryMi: 256, dbStorageGi: 1 });
  const [valid, setValid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetch(source, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!active) return;
        if (!r.ok) {
          setNotice({ ok: false, text: d?.error || 'Không tải được tài nguyên của app' });
          return;
        }
        setInfo(d);
        if (d.current) setValue({ cpuMillicores: d.current.cpuMillicores, memoryMi: d.current.memoryMi, dbStorageGi: d.current.dbStorageGi || 1 });
      })
      .catch(() => active && setNotice({ ok: false, text: 'Không tải được tài nguyên của app' }));
    return () => {
      active = false;
    };
  }, [source, reloadKey]);

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(source, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpu_millicores: value.cpuMillicores, memory_mi: value.memoryMi, db_storage_gi: value.dbStorageGi }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || 'Không đổi được tài nguyên');
      setNotice({ ok: true, text: 'Đã áp mức tài nguyên mới, app sẽ khởi động lại với giới hạn mới trong giây lát.' });
      setReloadKey((k) => k + 1);
    } catch (e) {
      setNotice({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const changed =
    !info?.current ||
    info.current.cpuMillicores !== value.cpuMillicores ||
    info.current.memoryMi !== value.memoryMi ||
    (info.hasDatabase && (info.current.dbStorageGi || 1) !== value.dbStorageGi);

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Tài nguyên</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {info?.current
            ? 'Mức CPU/RAM/database phân bổ cho app này trong gói hosting của bạn.'
            : 'App chưa được phân bổ tài nguyên (đang dùng mức do AI đặt hoặc mặc định). Chọn mức để áp giới hạn.'}
        </p>
      </div>
      {!info ? (
        notice ? null : <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      ) : (
        <ResourcePicker
          key={reloadKey}
          parts={info.parts}
          hasDatabase={info.hasDatabase}
          value={value}
          onChange={setValue}
          onValidity={setValid}
          app={appName}
          summarySource={source}
          minDbStorageGi={info.current?.dbStorageGi || 1}
        />
      )}
      {notice && (
        <div
          className={`text-xs px-3 py-2 rounded-md flex items-start gap-2 border ${
            notice.ok
              ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-500'
          }`}
        >
          {notice.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          {notice.text}
        </div>
      )}
      {info && (
        <button
          onClick={save}
          disabled={saving || !valid || !changed}
          className="flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Áp dụng
        </button>
      )}
    </div>
  );
}
