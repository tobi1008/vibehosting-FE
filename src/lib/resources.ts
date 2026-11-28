/**
 * Hàm thuần về tài nguyên dùng chung cho server và trình duyệt (không import Prisma).
 */

export type Allocation = { cpuMillicores: number; memoryMi: number; dbStorageGi: number };

export const RESOURCE_PRESETS = [
  { id: 'small', label: 'Nhỏ', cpuMillicores: 250, memoryMi: 256 },
  { id: 'medium', label: 'Vừa', cpuMillicores: 500, memoryMi: 512 },
  { id: 'large', label: 'Lớn', cpuMillicores: 1000, memoryMi: 1024 },
] as const;

/** Tối thiểu cho mỗi workload (container) của app */
export const MIN_CPU_PER_PART = 50;
export const MIN_MEMORY_PER_PART = 64;

export function wantsDatabase(dbType: unknown): boolean {
  const v = String(dbType ?? '').trim().toLowerCase();
  return Boolean(v) && !['none', 'no', 'false', 'null', 'undefined'].includes(v);
}

/** Số workload của app theo kiến trúc: web/backend/frontend, cộng database nếu có */
export function partsFor(arch: string | null | undefined, dbType: unknown, hasFrontend = true): number {
  const db = wantsDatabase(dbType) ? 1 : 0;
  switch (arch) {
    case 'fullstack':
      return 2 + db;
    case 'monorepo':
      return 1 + (hasFrontend ? 1 : 0) + db;
    default:
      return 1 + db;
  }
}
