/** Định dạng số liệu tài nguyên để hiển thị */

export function formatCpu(m: number | null | undefined): string {
  if (m === null || m === undefined) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 2)} vCPU` : `${m}m`;
}

export function formatMi(mi: number | null | undefined): string {
  if (mi === null || mi === undefined) return '—';
  if (mi >= 1024) return `${(mi / 1024).toFixed(mi % 1024 === 0 ? 0 : 1)} GiB`;
  return `${mi} MiB`;
}

export function percent(used: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

export function timeAgo(date: string | number | Date): string {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} ngày trước`;
  return new Date(date).toLocaleDateString('vi-VN');
}
