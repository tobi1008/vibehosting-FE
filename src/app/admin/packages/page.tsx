'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Database,
  FolderGit2,
  Loader2,
  MemoryStick,
  Package as PackageIcon,
  Pencil,
  Plus,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react';

type HostingPackage = {
  id: string;
  name: string;
  description: string | null;
  maxProjects: number;
  cpuMillicores: number;
  memoryMi: number;
  allowDatabase: boolean;
  dbStorageGi: number;
  isDefault: boolean;
  _count?: { users: number };
};

type FormState = Omit<HostingPackage, 'id' | '_count'> & { id?: string };

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  maxProjects: 3,
  cpuMillicores: 500,
  memoryMi: 512,
  allowDatabase: true,
  dbStorageGi: 1,
  isDefault: false,
};

function formatCpu(m: number) {
  return m % 1000 === 0 ? `${m / 1000} vCPU` : `${m}m CPU`;
}

function formatMemory(mi: number) {
  return mi % 1024 === 0 ? `${mi / 1024} GiB` : `${mi} MiB`;
}

export default function AdminPackagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

  const [packages, setPackages] = useState<HostingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    else if (status === 'authenticated' && !isAdmin) router.push('/');
  }, [status, isAdmin, router]);

  const fetchPackages = useCallback(async () => {
    const res = await fetch('/api/admin/packages', { cache: 'no-store' });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Không tải được danh sách gói');
    return (await res.json()) as HostingPackage[];
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    fetchPackages()
      .then((list) => active && setPackages(list))
      .catch((e) => active && setNotice({ type: 'error', text: e.message }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [isAdmin, fetchPackages]);

  const reload = async () => {
    try {
      setPackages(await fetchPackages());
    } catch (e) {
      setNotice({ type: 'error', text: (e as Error).message });
    }
  };

  const describeReapply = (r?: { updated: number; failed: string[] }) => {
    if (!r || (r.updated === 0 && r.failed.length === 0)) return '';
    const base = ` Đã áp lại giới hạn cho ${r.updated} app đang chạy.`;
    return r.failed.length ? `${base} Lỗi: ${r.failed.join(', ')}.` : base;
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch('/api/admin/packages', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Lưu gói thất bại');
      setNotice({
        type: 'ok',
        text: `Đã ${form.id ? 'cập nhật' : 'tạo'} gói ${form.name}.${describeReapply(data?.reapplied)}`,
      });
      setForm(null);
      await reload();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (pkg: HostingPackage) => {
    const users = pkg._count?.users || 0;
    const ok = window.confirm(
      `Xóa gói "${pkg.name}"?${users ? ` ${users} user đang dùng gói này sẽ chuyển về gói mặc định.` : ''}`,
    );
    if (!ok) return;
    const res = await fetch(`/api/admin/packages?id=${encodeURIComponent(pkg.id)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setNotice({ type: 'error', text: data?.error || 'Xóa gói thất bại' });
      return;
    }
    setNotice({ type: 'ok', text: `Đã xóa gói ${pkg.name}.${describeReapply(data?.reapplied)}` });
    await reload();
  };

  if (status === 'loading' || (isAdmin && loading)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <PackageIcon className="w-8 h-8" />
            Gói hosting
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Giới hạn số project, CPU/RAM mỗi container và database cho từng nhóm user. Gán gói cho user ở trang Users.
          </p>
        </div>
        <button
          onClick={() => {
            setFormError('');
            setForm({ ...EMPTY_FORM, isDefault: packages.length === 0 });
          }}
          className="flex items-center gap-2 bg-foreground text-background hover:bg-foreground/90 py-2.5 px-4 rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Tạo gói
        </button>
      </div>

      {notice && (
        <div
          className={`text-sm px-4 py-3 rounded-lg mb-6 flex items-start gap-2 border ${
            notice.type === 'ok'
              ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-500'
          }`}
        >
          {notice.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Đóng">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {packages.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center text-sm text-muted-foreground">
          Chưa có gói nào. User đang dùng gói dựng sẵn &quot;Cơ bản&quot; (3 project, 500m CPU, 512 MiB RAM, có
          database 1 GiB). Tạo gói đầu tiên và đánh dấu mặc định để thay thế.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h2 className="text-lg font-semibold text-foreground break-words">{pkg.name}</h2>
                {pkg.isDefault && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 shrink-0">
                    <Star className="w-3 h-3" /> Mặc định
                  </span>
                )}
              </div>
              {pkg.description && <p className="text-xs text-muted-foreground mb-3">{pkg.description}</p>}
              <ul className="space-y-2 text-sm text-foreground my-3 flex-1">
                <li className="flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 text-muted-foreground" /> Tối đa {pkg.maxProjects} project
                </li>
                <li className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-muted-foreground" /> {formatCpu(pkg.cpuMillicores)} / container
                </li>
                <li className="flex items-center gap-2">
                  <MemoryStick className="w-4 h-4 text-muted-foreground" /> {formatMemory(pkg.memoryMi)} RAM / container
                </li>
                <li className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  {pkg.allowDatabase ? `Database ${pkg.dbStorageGi} GiB` : 'Không có database'}
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-4 h-4" /> {pkg._count?.users || 0} user được gán
                  {pkg.isDefault ? ' (+ user chưa gán gói)' : ''}
                </li>
              </ul>
              <div className="flex gap-2 pt-3 border-t border-border">
                <button
                  onClick={() => {
                    setFormError('');
                    setForm({ ...pkg, description: pkg.description || '' });
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-border hover:bg-muted px-3 py-1.5 rounded-md text-xs font-medium"
                >
                  <Pencil className="w-3.5 h-3.5" /> Sửa
                </button>
                <button
                  onClick={() => remove(pkg)}
                  className="flex items-center justify-center gap-1.5 border border-red-500/30 text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded-md text-xs font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">{form.id ? `Sửa gói ${form.name}` : 'Tạo gói hosting'}</h2>
              <button onClick={() => setForm(null)} aria-label="Đóng">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <label className="block">
                <span className="text-muted-foreground text-xs font-medium">Tên gói</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Free, Pro, Business…"
                  className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-foreground"
                />
              </label>
              <label className="block">
                <span className="text-muted-foreground text-xs font-medium">Mô tả (tùy chọn)</span>
                <input
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-foreground"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <NumberField
                  label="Số project tối đa"
                  value={form.maxProjects}
                  min={1}
                  onChange={(v) => setForm({ ...form, maxProjects: v })}
                />
                <NumberField
                  label="CPU (millicore)"
                  hint="1000 = 1 vCPU"
                  value={form.cpuMillicores}
                  min={50}
                  step={50}
                  onChange={(v) => setForm({ ...form, cpuMillicores: v })}
                />
                <NumberField
                  label="RAM (MiB)"
                  hint="1024 = 1 GiB"
                  value={form.memoryMi}
                  min={64}
                  step={64}
                  onChange={(v) => setForm({ ...form, memoryMi: v })}
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.allowDatabase}
                  onChange={(e) => setForm({ ...form, allowDatabase: e.target.checked })}
                />
                <span>Cho phép tạo app có database</span>
              </label>
              {form.allowDatabase && (
                <NumberField
                  label="Dung lượng database (GiB)"
                  value={form.dbStorageGi}
                  min={1}
                  onChange={(v) => setForm({ ...form, dbStorageGi: v })}
                />
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                <span>Gói mặc định (áp dụng cho user chưa được gán gói và user mới đăng ký)</span>
              </label>
              <p className="text-xs text-muted-foreground">
                CPU/RAM áp cho từng container của app. Khi lưu, giới hạn mới được áp ngay cho các app đang chạy của user
                thuộc gói. Dung lượng database chỉ áp cho database tạo mới (ổ đĩa đã cấp không thu nhỏ được).
              </p>
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-3 py-2 rounded-md flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
              <button onClick={() => setForm(null)} className="px-4 py-2 rounded-md border border-border text-sm">
                Hủy
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {form.id ? 'Lưu thay đổi' : 'Tạo gói'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  min,
  step = 1,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 outline-none focus:border-foreground"
      />
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
