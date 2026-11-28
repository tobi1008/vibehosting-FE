/**
 * Một lần sau khi chuyển gói hosting sang "tổng tài nguyên": phân bổ CPU/RAM/database cho các project
 * đang chạy mà chưa có AppAllocation (project tạo trước khi có tính năng chọn tài nguyên).
 *
 * - Chỉ xử lý user thường (admin không giới hạn, giữ nguyên).
 * - Phần còn lại của gói được chia đều cho các project chưa có mức (tối thiểu 50m CPU / 64 MiB RAM mỗi thành phần);
 *   project có database nhận 1 GiB (ổ database đã cấp không thu nhỏ được).
 * - Mặc định chỉ in kế hoạch. Thêm --apply để ghi DB và gửi giới hạn cho Vibe Core (app khởi động lại với giới hạn mới).
 *
 *   node scripts/backfill-allocations.mjs            # xem trước
 *   node scripts/backfill-allocations.mjs --apply    # thực hiện
 */
import nextEnv from '@next/env';
import { PrismaClient } from '@prisma/client';

nextEnv.loadEnvConfig(process.cwd());

const APPLY = process.argv.includes('--apply');
const MIN_CPU = 50;
const MIN_MEM = 64;
const FALLBACK = { cpuMillicores: 1000, memoryMi: 1024, dbStorageGi: 2, allowDatabase: true };

const wantsDb = (v) => Boolean(v) && !['none', 'no', 'false', 'null'].includes(String(v).toLowerCase());
function partsFor(arch, db, hasFe) {
  const d = wantsDb(db) ? 1 : 0;
  if (arch === 'fullstack') return 2 + d;
  if (arch === 'monorepo') return 1 + (hasFe ? 1 : 0) + d;
  return 1 + d;
}

async function main() {
  const prisma = new PrismaClient();
  const base = (process.env.NEXT_PUBLIC_API_URL || 'https://api.quyenlt.com/api/deploy').replace(/\/api\/deploy\/?$/, '');
  const defaultPkg = await prisma.package.findFirst({ where: { isDefault: true } });
  const users = await prisma.user.findMany({
    where: { role: { not: 'admin' } },
    include: { package: true, projects: true, allocations: true },
  });
  for (const u of users) {
    const pkg = u.package || defaultPkg || FALLBACK;
    const names = new Set(u.projects.map((p) => p.app_name));
    const existing = u.allocations.filter((a) => names.has(a.appName));
    const missing = u.projects.filter((p) => !existing.some((a) => a.appName === p.app_name));
    if (!missing.length) continue;
    const used = existing.reduce((t, a) => ({ cpu: t.cpu + a.cpuMillicores, mem: t.mem + a.memoryMi }), { cpu: 0, mem: 0 });
    const freeCpu = Math.max(0, pkg.cpuMillicores - used.cpu);
    const freeMem = Math.max(0, pkg.memoryMi - used.mem);
    for (const p of missing) {
      const parts = partsFor(p.arch_type, p.db_type, p.arch_type !== 'monorepo' || Boolean(p.fe_domain));
      const alloc = {
        cpuMillicores: Math.max(parts * MIN_CPU, Math.floor(freeCpu / missing.length / 50) * 50),
        memoryMi: Math.max(parts * MIN_MEM, Math.floor(freeMem / missing.length / 64) * 64),
        dbStorageGi: wantsDb(p.db_type) ? 1 : 0,
      };
      console.log(`@${u.username} ${p.app_name}: ${alloc.cpuMillicores}m CPU, ${alloc.memoryMi} MiB RAM, DB ${alloc.dbStorageGi} GiB (${parts} thành phần)`);
      if (!APPLY) continue;
      await prisma.appAllocation.upsert({
        where: { appName: p.app_name },
        create: { appName: p.app_name, userId: u.id, parts, ...alloc },
        update: { userId: u.id, parts, ...alloc },
      });
      const res = await fetch(`${base}/api/apps/${encodeURIComponent(p.app_name)}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.VIBE_API_KEY || '' },
        body: JSON.stringify({
          cpu: `${alloc.cpuMillicores}m`,
          memory: `${alloc.memoryMi}Mi`,
          db_storage: `${Math.max(1, alloc.dbStorageGi)}Gi`,
          allow_database: pkg.allowDatabase,
          parts,
        }),
      });
      const body = await res.json().catch(() => ({}));
      console.log(`   → Vibe Core ${res.status}: ${JSON.stringify(body.updated || body.detail || body)}`);
    }
  }
  await prisma.$disconnect();
  if (!APPLY) console.log('\n(Xem trước, chưa ghi gì. Thêm --apply để thực hiện.)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
