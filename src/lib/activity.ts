import { prisma } from '@/lib/prisma';

/** Các loại hoạt động hiện ở trang Activity */
export type ActivityAction =
  | 'deploy'
  | 'delete'
  | 'redeploy'
  | 'rollback'
  | 'cicd'
  | 'ai_fix'
  | 'package'
  | 'ai_key_added'
  | 'ai_key_removed'
  | 'password';

/**
 * Ghi một dòng nhật ký hoạt động. Không bao giờ làm hỏng thao tác chính: lỗi ghi log chỉ in ra console.
 * Không ghi bí mật (key, mật khẩu) vào detail.
 */
export async function logActivity(entry: {
  userId: string;
  action: ActivityAction;
  target?: string | null;
  detail?: string | null;
  actorId?: string | null;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        target: entry.target?.slice(0, 120) || null,
        detail: entry.detail?.slice(0, 500) || null,
        actorId: entry.actorId && entry.actorId !== entry.userId ? entry.actorId : null,
      },
    });
  } catch (e) {
    console.error('Không ghi được nhật ký hoạt động:', e);
  }
}

/** Chủ sở hữu app (để ghi nhật ký vào đúng tài khoản khi admin thao tác trên app của user) */
export async function appOwnerId(appName: string): Promise<string | null> {
  const base = appName.replace(/-(be|fe|monorepo)$/, '');
  const project = await prisma.project.findFirst({
    where: { app_name: { in: Array.from(new Set([appName, base])) } },
    select: { userId: true },
  });
  return project?.userId ?? null;
}
