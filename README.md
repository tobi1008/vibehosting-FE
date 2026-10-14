# Vibe Hosting: Web Dashboard

**Vibe Hosting** là một nền tảng PaaS dùng AI để triển khai ứng dụng web, lấy cảm hứng từ Vercel và Railway. Repo này là **giao diện web (dashboard)** của nền tảng. Người dùng đăng nhập, kết nối GitHub, chọn mã nguồn và triển khai ứng dụng chỉ với vài thao tác. Sau đó họ có thể theo dõi log, sửa code trực tuyến, quay về phiên bản cũ và nhờ AI chẩn đoán lỗi.

Phần xử lý triển khai (build, Kubernetes, AI) nằm ở repo backend **[Vibe Core](https://github.com/tobi1008/vibe-core)**.

## Mục lục

- [Tính năng](#tính-năng)
- [Kiến trúc](#kiến-trúc)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc mã nguồn](#cấu-trúc-mã-nguồn)
- [Bảo mật và phân quyền](#bảo-mật-và-phân-quyền)
- [API routes](#api-routes)
- [Cài đặt và chạy local](#cài-đặt-và-chạy-local)
- [Triển khai lên Vercel](#triển-khai-lên-vercel)
- [Giới hạn hiện tại và hướng phát triển](#giới-hạn-hiện-tại-và-hướng-phát-triển)

---

## Tính năng

**Tài khoản**
- Đăng ký, đăng nhập (NextAuth, phiên JWT); mật khẩu được băm bằng bcrypt.
- Kết nối tài khoản GitHub qua OAuth để chọn repo, tự đăng ký webhook và push code.
- Trang quản trị cho admin: quản lý người dùng và đăng nhập thay người dùng (impersonate) để hỗ trợ.

**Triển khai ứng dụng** (`/new`)
- Repo đơn, repo kèm database (có thể tải lên file backup), fullstack 2 repo, monorepo.
- CMS / mã nguồn mở với database trống: WordPress, Laravel, Ghost hoặc repo tuỳ chọn.
- Tải lên file nén (`.zip`, `.tar.gz`, `.rar`, `.7z`…) và hiển thị tiến độ upload.
- Chọn AI engine (Gemini Flash, Claude, LLM mã nguồn mở); dùng subdomain hệ thống hoặc tên miền riêng.

**Quản lý ứng dụng** (`/project/[name]`)

| Tab | Chức năng |
|---|---|
| Overview | Thông tin, tên miền, trạng thái triển khai |
| Build Logs | Log build theo thời gian thực |
| Runtime Logs | Log của container đang chạy (tách riêng frontend / backend) |
| Code Editor | Duyệt và sửa mã nguồn bằng Monaco Editor (nhân của VS Code), push lên GitHub cá nhân |
| AI Debug | AI đọc log và sự kiện Kubernetes, chẩn đoán lỗi, đề xuất cách sửa; người dùng duyệt rồi mới áp dụng; có khung chat với AI |
| Deploy History | Lịch sử phiên bản và rollback |
| Settings | Bật / tắt Auto Deploy (CI/CD qua GitHub Webhook) |

---

## Kiến trúc

```
 Trình duyệt (React 19, Monaco Editor)
        │  chỉ gọi /api/* cùng domain, kèm cookie phiên đăng nhập
        ▼
 ┌──────────────────────────────────────────────┐
 │  Next.js server (Vercel)                     │
 │  - NextAuth: đăng nhập, phiên JWT            │
 │  - Prisma + PostgreSQL: user, project        │
 │  - API routes (Backend-for-Frontend):        │
 │      kiểm tra đăng nhập + quyền sở hữu app   │
 │      → gắn X-API-Key → gọi Vibe Core         │
 └───────────┬──────────────────────┬───────────┘
             │                      │
             ▼                      ▼
   Vibe Core API (FastAPI)      GitHub REST API
   build, K3s, database, AI     OAuth, repo, webhook, push
```

Trình duyệt **không bao giờ gọi thẳng** backend Vibe Core. Mọi yêu cầu đi qua API route phía server của Next.js (mô hình Backend-for-Frontend). Nhờ vậy:
- Khoá API của backend chỉ nằm ở server, không xuất hiện trong mã JavaScript gửi xuống trình duyệt.
- Mỗi yêu cầu được kiểm tra đăng nhập và quyền sở hữu app trước khi chuyển tiếp.

---

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Giao diện | Tailwind CSS 4, Framer Motion, Lucide Icons |
| Trình soạn code | Monaco Editor (`@monaco-editor/react`) |
| Xác thực | NextAuth.js 4 (Credentials, JWT), bcryptjs |
| Cơ sở dữ liệu | PostgreSQL, Prisma ORM 6 |
| GitHub | OAuth App, Octokit (GitHub REST API) |
| Hosting | Vercel |

---

## Cấu trúc mã nguồn

```
src/
├── app/
│   ├── page.tsx                 Dashboard: danh sách project
│   ├── new/                     Trình tạo và triển khai project mới
│   ├── project/[name]/          Trang quản lý một project (các tab ở trên)
│   ├── login/, register/        Đăng nhập, đăng ký
│   ├── profile/                 Hồ sơ cá nhân, kết nối GitHub
│   ├── admin/users/             Quản trị người dùng (chỉ admin)
│   └── api/                     API routes phía server (xem bảng bên dưới)
├── components/
│   ├── AiDebug/                 Tab AI Debug và chat
│   ├── AiEngine/                Bộ chọn AI engine
│   ├── DeployArchive/           Triển khai từ file nén
│   ├── DeployHistory/           Lịch sử triển khai, rollback
│   ├── FileManager/             Cây thư mục, Code Editor, push GitHub
│   ├── ProjectCicdSettings.tsx  Cấu hình Auto Deploy
│   └── Navbar.tsx
├── lib/
│   ├── auth.ts                  Cấu hình NextAuth, đăng nhập admin, impersonate
│   ├── backend.ts               Gọi Vibe Core (gắn API key) và kiểm tra quyền
│   ├── prisma.ts                Prisma client
│   ├── githubToken.ts           Lưu và làm mới token GitHub OAuth
│   ├── ProjectContext.tsx       State danh sách project phía client
│   └── deployment.ts            Phân tích trạng thái triển khai từ log
prisma/schema.prisma             Mô hình dữ liệu: User, Project
```

Tài liệu chi tiết từng phân hệ: [PROJECT_REPORT.md](PROJECT_REPORT.md).

---

## Bảo mật và phân quyền

| Cơ chế | Mô tả |
|---|---|
| Đăng nhập bắt buộc | Mọi API route (trừ đăng ký / đăng nhập) yêu cầu phiên đăng nhập hợp lệ. |
| Quyền sở hữu app | Chỉ chủ sở hữu (hoặc admin) mới xem log, sửa code, triển khai lại, rollback, xoá hay debug một app. Kiểm tra tập trung trong `src/lib/backend.ts`. |
| Tên app duy nhất | Không thể tạo hoặc triển khai app trùng tên với app của người dùng khác. |
| Khoá API backend | `VIBE_API_KEY` chỉ dùng phía server, không có tiền tố `NEXT_PUBLIC_`. |
| Webhook GitHub | Webhook do hệ thống tự đăng ký đều được ký bằng `GITHUB_WEBHOOK_SECRET` để backend xác minh. |
| OAuth GitHub | Tham số `state` được ký HMAC để chống CSRF. |
| Bí mật cấu hình | Mật khẩu admin và các secret chỉ đọc từ biến môi trường; thiếu biến thì tính năng tương ứng bị tắt, không dùng giá trị mặc định. |

---

## API routes

Các route trong `src/app/api/` đóng vai trò cầu nối giữa trình duyệt với Vibe Core, GitHub và database.

| Nhóm | Route | Mục đích |
|---|---|---|
| Xác thực | `auth/[...nextauth]`, `auth/register` | Đăng nhập, đăng ký |
| Người dùng | `user/profile`, `user/github`, `user/github/connect`, `user/github/callback`, `user/github/repos` | Hồ sơ, kết nối GitHub OAuth, danh sách repo |
| Project | `projects`, `projects/[name]/cicd` | Danh sách project của người dùng; bật / tắt Auto Deploy và đăng ký webhook |
| Triển khai | `deploy`, `deploy-with-db`, `deploy-fullstack`, `deploy-monorepo`, `deploy-open-source`, `deploy-archive`, `deploy-archive-with-db` | Chuyển yêu cầu triển khai tới Vibe Core |
| Vận hành | `apps/[name]` (DELETE), `apps/[name]/config`, `apps/[name]/redeploy`, `apps/[name]/history`, `apps/[name]/rollback`, `logs/[name]`, `pod-logs/[name]` | Xoá app, cấu hình, build lại, lịch sử, rollback, log |
| Mã nguồn | `project/[name]/files`, `project/[name]/file`, `project/[name]/github/push` | Duyệt, đọc, ghi file; push lên GitHub |
| AI | `ai-providers`, `ai-debug/analyze`, `ai-debug/chat`, `ai-debug/[appName]/execute` | Danh sách AI engine, chẩn đoán, chat, thực thi hành động đã duyệt |
| Quản trị | `admin/users`, `admin/impersonate` | Quản lý người dùng, đăng nhập thay (chỉ admin) |

---

## Cài đặt và chạy local

### Yêu cầu
- Node.js 20+
- PostgreSQL
- Một backend [Vibe Core](https://github.com/tobi1008/vibe-core) đang chạy
- (Tuỳ chọn) GitHub OAuth App, để dùng các tính năng liên kết GitHub

### Các bước

```bash
git clone https://github.com/tobi1008/vibehosting-FE.git
cd vibehosting-FE
npm install

# Tạo file .env (xem bảng bên dưới), sau đó tạo bảng trong database
npx prisma db push

npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

### Biến môi trường

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URL` | Có | Chuỗi kết nối PostgreSQL |
| `NEXTAUTH_SECRET` | Có | Khoá ký phiên đăng nhập; tạo bằng `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Có | URL gốc của dashboard, ví dụ `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | Có | Endpoint deploy của Vibe Core, dạng `https://<api-domain>/api/deploy` |
| `VIBE_API_KEY` | Có | Trùng với `VIBE_API_KEY` của Vibe Core |
| `GITHUB_WEBHOOK_SECRET` | Khuyến nghị | Trùng với `GITHUB_WEBHOOK_SECRET` của Vibe Core |
| `ADMIN_PASSWORD` | Khuyến nghị | Mật khẩu của tài khoản `admin`; tài khoản được tạo tự động ở lần đăng nhập đầu. Không đặt thì không đăng nhập admin được. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Tuỳ chọn | Thông tin GitHub OAuth App; callback URL là `<NEXTAUTH_URL>/api/user/github/callback` |

### Lệnh hữu ích

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy môi trường phát triển |
| `npm run build` | Sinh Prisma client và build production |
| `npm run start` | Chạy bản đã build |
| `npm run lint` | Kiểm tra lint |

---

## Triển khai lên Vercel

1. Import repo vào Vercel (framework preset **Next.js**). Lệnh build mặc định `npm run build` đã bao gồm `prisma generate`.
2. Khai báo các biến môi trường ở bảng trên cho môi trường **Production**. Đánh dấu **Sensitive** cho các biến bí mật (`DATABASE_URL`, `NEXTAUTH_SECRET`, `VIBE_API_KEY`, `GITHUB_WEBHOOK_SECRET`, `ADMIN_PASSWORD`, `GITHUB_CLIENT_SECRET`).
3. Mỗi lần push lên nhánh `main`, Vercel tự build và triển khai. Sau khi thay đổi biến môi trường, cần **Redeploy** để biến mới có hiệu lực.

---

## Giới hạn hiện tại và hướng phát triển

| Giới hạn | Hướng cải thiện |
|---|---|
| GitHub token của người dùng được lưu trong database dưới dạng văn bản thường. | Mã hoá token trước khi lưu (ví dụ AES-GCM với khoá từ biến môi trường). |
| Tên app là định danh duy nhất trên toàn hệ thống, dùng chung cho cả dashboard và Kubernetes. | Tách định danh nội bộ khỏi tên hiển thị, gắn namespace theo người dùng. |
| Trạng thái triển khai được suy ra bằng cách phân tích log. | Nhận trạng thái có cấu trúc (webhook hoặc API trạng thái) từ backend. |
| Chưa có bộ kiểm thử tự động. | Bổ sung unit test cho phần phân quyền và integration test cho các luồng triển khai. |
