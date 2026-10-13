import { NextResponse } from 'next/server';

export interface OpenSourceTemplate {
  id: string;
  name: string;
  category: string;
  default_repo: string;
  default_db: string;
  description: string;
  badge: string;
}

export const DEFAULT_OPEN_SOURCE_TEMPLATES: OpenSourceTemplate[] = [
  {
    id: 'wordpress',
    name: 'WordPress (Official)',
    category: 'CMS & Blog',
    default_repo: 'https://github.com/WordPress/WordPress.git',
    default_db: 'mysql',
    description:
      'Cài đặt WordPress nguyên bản từ GitHub chính thức, tự sinh 8 Salt keys, kích hoạt SSL Traefik reverse proxy và cấp phát MySQL trắng sạch.',
    badge: '1-Click Setup',
  },
  {
    id: 'laravel',
    name: 'Laravel Starter',
    category: 'PHP Framework',
    default_repo: 'https://github.com/laravel/laravel.git',
    default_db: 'mysql',
    description:
      'Khởi tạo Laravel sạch, tự động sao chép .env.example và tiêm cấu hình DB_HOST, DB_DATABASE, DB_USERNAME, APP_URL.',
    badge: 'Auto .env',
  },
  {
    id: 'ghost',
    name: 'Ghost CMS',
    category: 'Publishing Platform',
    default_repo: 'https://github.com/TryGhost/Ghost.git',
    default_db: 'mysql',
    description: 'Nền tảng blog xuất bản hiện đại viết bằng Node.js với MySQL.',
    badge: 'Node.js',
  },
  {
    id: 'custom',
    name: 'Custom Open-Source Repo',
    category: 'Tùy biến GitHub',
    default_repo: '',
    default_db: 'mysql',
    description:
      'Triển khai bất kỳ repository GitHub mã nguồn mở nào với Database trắng hoàn toàn (MySQL, PostgreSQL, MongoDB, MariaDB) không cần file backup.',
    badge: 'Clean DB',
  },
];

export async function GET() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.quyenlt.com/api/deploy';
    const baseUrl = apiUrl.replace(/\/api\/deploy\/?$/, '');

    const res = await fetch(`${baseUrl}/api/open-source-templates`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.templates && Array.isArray(data.templates)) {
        return NextResponse.json(data);
      }
    }
  } catch (err) {
    console.warn('Error fetching /api/open-source-templates from backend, using fallback:', err);
  }

  // Fallback defaults
  return NextResponse.json({
    status: 'success',
    templates: DEFAULT_OPEN_SOURCE_TEMPLATES,
  });
}
