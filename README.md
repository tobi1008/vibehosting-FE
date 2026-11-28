# Vibe Hosting: Web Dashboard

**Vibe Hosting** là một nền tảng hosting (PaaS) dùng AI để triển khai ứng dụng web, lấy cảm hứng từ Vercel và Railway. Repo này là **giao diện web (dashboard)**: người dùng đăng nhập, chọn mã nguồn từ GitHub hoặc tải file nén, chọn tài nguyên trong gói hosting và AI engine, rồi triển khai. Sau đó họ theo dõi log và tài nguyên, sửa code trực tuyến, rollback, nhờ AI chẩn đoán hoặc để AI Agent sửa lỗi, và liên kết Telegram để làm việc với **Hermes**, quản gia của hệ thống.

Phần xử lý triển khai (build, K3s, AI, Hermes) nằm ở repo backend **[Vibe Core](https://github.com/tobi1008/vibe-core)**.

## Mục lục

- [Tính năng](#tính-năng)
- [Kiến trúc](#kiến-trúc)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc mã nguồn](#cấu-trúc-mã-nguồn)
- [Mô hình dữ liệu](#mô-hình-dữ-liệu)
- [Bảo mật và phân quyền](#bảo-mật-và-phân-quyền)
- [API routes](#api-routes)
- [Cài đặt và chạy local](#cài-đặt-và-chạy-local)
- [Triển khai lên Vercel](#triển-khai-lên-vercel)
- [Giới hạn hiện tại và hướng phát triển](#giới-hạn-hiện-tại-và-hướng-phát-triển)

---

## Tính năng

**Tài khoản**
- Đăng ký, đăng nhập (NextAuth, phiên JWT), mật khẩu băm bằng bcrypt.
- **Settings:** sửa tên/email, đổi mật khẩu (phải nhập mật khẩu hiện tại), chọn giao diện sáng/tối/theo hệ thống.
- **Integrations:**
  - kết nối GitHub (OAuth) để chọn repo, tự đăng ký webhook và push code;
  - liên kết Telegram với Hermes;
  - gắn **API key AI riêng** (OpenAI, Anthropic, Google Gemini, API tương thích OpenAI). Key được gọi thử trước khi lưu và không bao giờ hiển thị lại.

**Triển khai ứng dụng** (`/new`)
- **Nguồn:**
  - repo đơn, repo kèm database (có thể tải file backup);
  - CMS / mã nguồn mở với database trống (WordPress, Laravel, Ghost, repo tùy chọn);
  - fullstack 2 repo, monorepo;
  - file nén (`.zip`, `.tar.gz`, `.rar`, `.7z`…), có hiện tiến độ upload.
- **Tài nguyên:** chọn trong phần còn lại của gói hosting, gồm Nhỏ (250m CPU / 256 MiB), Vừa (500m / 512 MiB), Lớn (1 vCPU / 1 GiB) hoặc tùy chỉnh, kèm dung lượng database.
- **AI engine:** Google Antigravity (Gemini 3.8 Flash), Gemini 4 Hydrogen, Claude Code, hoặc key AI riêng của người dùng.
- **Tên miền:** subdomain hệ thống hoặc tên miền riêng.

**Quản lý ứng dụng** (`/project/[name]`)

| Tab | Chức năng |
|---|---|
| Tổng quan | Thông tin triển khai, tên miền, kiến trúc |
| Mã nguồn | Duyệt và sửa mã nguồn bằng Monaco Editor, push lên GitHub cá nhân |
| Build Logs | Log clone, build image và apply K3s theo thời gian thực |
| Runtime Logs | Log container đang chạy (tách frontend / backend) |
| Hermes Check | Kết quả Hermes Agent kiểm tra tổng thể sau triển khai |
| AI Debug | Chẩn đoán từ log và sự kiện K3s, đề xuất cách sửa để duyệt; khung chat với AI; **chế độ Agent**: AI đọc/sửa code và file K3s trên bản sao của app, hiện diff từng file, người dùng chọn file rồi bấm **Áp dụng** (có tùy chọn tự áp dụng) |
| Lịch sử | Các phiên bản đã triển khai và rollback |
| Cài đặt | Đổi tài nguyên của app trong gói (áp ngay lên app đang chạy), bật/tắt Auto Deploy (CI/CD qua GitHub Webhook) |

**Theo dõi**
- **Usage:**
  - CPU, RAM, dung lượng database (đo thật trong Pod) và ổ tạm của từng app;
  - phần đã phân bổ so với tổng của gói;
  - admin xem thêm tài nguyên từng node K3s và tổng theo từng người dùng.
- **Domains:** mọi tên miền của các app, mã HTTPS trả về, thời gian phản hồi, số ngày còn lại của chứng chỉ SSL.
- **Activity:** nhật ký các thao tác, ghi rõ khi admin thao tác thay người dùng. Gồm:
  - triển khai, xóa app, build lại, rollback, bật/tắt CI/CD;
  - áp dụng sửa lỗi của AI, đổi tài nguyên, đổi gói;
  - thêm/xóa key AI, đổi mật khẩu.

**Quản trị** (chỉ admin)
- **Users:** tạo, xóa người dùng, đổi mật khẩu, đăng nhập thay (impersonate) để hỗ trợ, gán gói hosting.
- **Packages:**
  - tạo, sửa, xóa gói hosting: số project, tổng CPU, tổng RAM, có database không và tổng dung lượng database;
  - chọn gói mặc định;
  - khi sửa hoặc giảm gói, giới hạn mới được áp ngay cho các app đang chạy của người dùng thuộc gói.
- **Telegram:** cấu hình bot (token từ @BotFather), gửi thử báo cáo hằng ngày.

---

## Kiến trúc

```
 Trình duyệt (React 19)
        │  chỉ gọi /api/* cùng domain, kèm cookie phiên đăng nhập
        ▼
 ┌────────────────────────────────────────────────────┐
 │  Next.js server (Vercel)                           │
 │  - NextAuth: đăng nhập, phiên JWT                  │
 │  - Prisma + PostgreSQL: user, project, gói,        │
 │    phân bổ tài nguyên, nhật ký hoạt động           │
 │  - API routes (Backend-for-Frontend):              │
 │      kiểm tra đăng nhập, quyền sở hữu app, gói     │
 │      → gắn X-API-Key → gọi Vibe Core               │
 └──────────┬───────────────────────────┬─────────────┘
            │                           │
            ▼                           ▼
  Vibe Core API (FastAPI)          GitHub REST API
  build, K3s, AI, Hermes           OAuth, repo, webhook, push
            │
            └─ GET /api/internal/telegram/directory (X-API-Key)
               Vibe Core hỏi lại danh bạ người dùng, gói và chủ app
```

Trình duyệt **không gọi thẳng** Vibe Core, trừ một ngoại lệ là upload file nén. Vercel giới hạn body của function ở 4,5 MB, nên route `upload-token` kiểm tra quyền, gói và tài nguyên, rồi cấp token ngắn hạn để trình duyệt gửi file thẳng tới Vibe Core.

Nhờ mô hình Backend-for-Frontend:
- `VIBE_API_KEY` chỉ nằm ở server.
- Mọi yêu cầu được kiểm tra đăng nhập, quyền sở hữu app và giới hạn gói trước khi chuyển tiếp.
- Trước mỗi lần triển khai, frontend gửi cho Vibe Core **chủ app** (`/api/apps/{app}/owner`) và **phần tài nguyên đã phân bổ** (`/api/apps/{app}/resources`). Vibe Core không phải tin dữ liệu từ trình duyệt.

---

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Giao diện | Tailwind CSS 4, Framer Motion, Lucide Icons |
| Trình soạn code | Monaco Editor (`@monaco-editor/react`) |
| Xác thực | NextAuth.js 4 (Credentials, JWT), bcryptjs |
| Cơ sở dữ liệu | PostgreSQL (Neon), Prisma ORM 6 |
| GitHub | OAuth App, Octokit (GitHub REST API) |
| Hosting | Vercel |

---

## Cấu trúc mã nguồn

```
src/
├── app/
│   ├── page.tsx                  Dashboard: danh sách project
│   ├── new/                      Tạo và triển khai project (chọn tài nguyên, AI engine)
│   ├── project/[name]/           Quản lý một project (các tab ở trên)
│   ├── usage/, domains/, activity/, integrations/, settings/
│   ├── profile/                  Hồ sơ, gói hosting, GitHub
│   ├── login/, register/
│   ├── admin/users/, admin/packages/   Quản trị (chỉ admin)
│   └── api/                      API routes phía server (bảng bên dưới)
├── components/
│   ├── AiDebug/                  Tab AI Debug, chat, AgentSessionCard (diff, Áp dụng)
│   ├── AiEngine/                 Bộ chọn AI engine
│   ├── DeployArchive/            Triển khai từ file nén
│   ├── DeployHistory/            Lịch sử triển khai, rollback
│   ├── FileManager/              Cây thư mục, Code Editor, push GitHub
│   ├── HealthReport/             Kết quả Hermes Check
│   ├── ProjectSettings/          Đổi tài nguyên của project
│   ├── ResourcePicker.tsx        Chọn CPU/RAM/database trong phần còn lại của gói
│   ├── PackageCard.tsx, UsageBar.tsx
│   ├── AiCredentialsCard.tsx     Key AI riêng
│   ├── TelegramLinkCard.tsx, TelegramBotSettings.tsx
│   └── ProjectCicdSettings.tsx, Navbar.tsx, ThemeToggle.tsx
├── lib/
│   ├── auth.ts                   NextAuth, đăng nhập admin, impersonate
│   ├── backend.ts                Gọi Vibe Core, kiểm tra quyền, đăng ký chủ app, kiểm tra gói khi triển khai
│   ├── packages.ts               Gói hosting, phân bổ tài nguyên, gửi giới hạn cho Vibe Core
│   ├── resources.ts              Mức có sẵn, số thành phần của app (dùng chung server và trình duyệt)
│   ├── activity.ts               Ghi nhật ký hoạt động
│   ├── useAiProvider.ts          Danh sách AI engine (kèm key riêng của người dùng)
│   └── githubToken.ts, projectFiles.ts, deployment.ts, format.ts, prisma.ts
prisma/schema.prisma              Mô hình dữ liệu
scripts/backfill-allocations.mjs  Phân bổ tài nguyên cho project tạo trước khi có tính năng chọn tài nguyên
```

Tài liệu chi tiết từng phân hệ: [PROJECT_REPORT.md](PROJECT_REPORT.md).

---

## Mô hình dữ liệu

| Model | Nội dung |
|---|---|
| `User` | Tài khoản, vai trò (`user` / `admin`), token GitHub, gói hosting (`packageId`) |
| `Project` | App của người dùng: tên app, repo, tên miền, kiến trúc, loại database, trạng thái, Auto Deploy |
| `Package` | Gói hosting: số project tối đa, **tổng** CPU (millicore), **tổng** RAM (MiB), có database không, tổng dung lượng database (GiB), gói mặc định |
| `AppAllocation` | Tài nguyên người dùng phân bổ cho từng app (CPU, RAM, database, số thành phần); tổng các app không vượt gói |
| `ActivityLog` | Nhật ký hoạt động (người bị tác động, người thực hiện, hành động, đối tượng, chi tiết) |

Người dùng chưa được gán gói thì dùng gói đánh dấu mặc định. Nếu chưa có gói nào, họ dùng gói dựng sẵn "Cơ bản" (3 project, tổng 1 vCPU, 1 GiB RAM, database 2 GiB). Admin không bị giới hạn.

---

## Bảo mật và phân quyền

| Cơ chế | Mô tả |
|---|---|
| Đăng nhập bắt buộc | Mọi API route yêu cầu phiên đăng nhập, trừ đăng ký / đăng nhập và route nội bộ dùng `X-API-Key`. |
| Quyền sở hữu app | Chỉ chủ app (hoặc admin) mới xem log, sửa code, triển khai lại, rollback, xóa, đổi tài nguyên, chạy AI Debug. Kiểm tra tập trung trong `src/lib/backend.ts` (`requireAppAccess`). |
| Gói hosting | `requireAppNameAvailable` chặn tên app trùng của người khác, chặn khi hết số project, kiểm tra mức tài nguyên không vượt phần còn lại của gói, lưu phân bổ rồi mới cho triển khai. Vibe Core còn tự ghi đè giới hạn vào manifest và chặn database khi gói không cho phép. |
| Key AI riêng | Proxy luôn gắn `user_id` của phiên đăng nhập (không lấy từ body). Key được mã hóa và lưu ở Vibe Core; frontend chỉ nhận 4 ký tự cuối. |
| Khóa API backend | `VIBE_API_KEY` chỉ dùng phía server, không có tiền tố `NEXT_PUBLIC_`. Route nội bộ `internal/telegram/directory` so khớp key theo thời gian hằng. |
| Webhook GitHub | Ký bằng `GITHUB_WEBHOOK_SECRET` để backend xác minh. |
| OAuth GitHub | Tham số `state` ký HMAC chống CSRF. |
| Đổi mật khẩu | Phải nhập đúng mật khẩu hiện tại; mật khẩu mới tối thiểu 8 ký tự. |
| Bí mật cấu hình | Mật khẩu admin và các secret chỉ đọc từ biến môi trường; thiếu biến thì tính năng tương ứng bị tắt. |

---

## API routes

| Nhóm | Route | Mục đích |
|---|---|---|
| Xác thực | `auth/[...nextauth]`, `auth/register` | Đăng nhập, đăng ký |
| Người dùng | `user/profile`, `user/password` | Hồ sơ, đổi mật khẩu |
| | `user/github`, `user/github/connect`, `user/github/callback`, `user/github/repos` | GitHub OAuth, danh sách repo |
| | `user/package`, `user/allocation` | Gói của người dùng; tài nguyên đã phân bổ, còn lại và các mức có sẵn |
| | `user/usage`, `user/domains`, `user/activity` | Usage (admin thêm `?scope=all`), tên miền và kiểm tra HTTPS, nhật ký hoạt động |
| | `user/ai-credentials`, `user/ai-credentials/[id]/[action]` | Key AI riêng: liệt kê, thêm/sửa, xóa, gọi thử, đặt mặc định |
| | `user/telegram` | Liên kết Telegram với Hermes |
| Project | `projects` | Danh sách, lưu, xóa project (kiểm tra số project của gói, xóa phân bổ khi xóa) |
| | `projects/[name]/cicd`, `projects/[name]/resources` | Auto Deploy và webhook; xem / đổi tài nguyên của app |
| Triển khai | `deploy`, `deploy-with-db`, `deploy-fullstack`, `deploy-monorepo`, `deploy-open-source`, `upload-token` | Kiểm tra quyền, gói, tài nguyên, đăng ký chủ app rồi chuyển tới Vibe Core; file nén dùng token ngắn hạn |
| Vận hành | `apps/[name]` (DELETE), `apps/[name]/config`, `apps/[name]/redeploy`, `apps/[name]/history`, `apps/[name]/rollback`, `apps/[name]/health-report`, `apps/[name]/verify`, `logs/[name]`, `pod-logs/[name]` | Xóa app, cấu hình, build lại, lịch sử, rollback, Hermes Check, log |
| Mã nguồn | `project/[name]/files`, `project/[name]/file`, `project/[name]/github/push` | Duyệt, đọc, ghi file; push GitHub |
| AI | `ai-providers` | AI engine của hệ thống kèm key riêng của người dùng |
| | `ai-debug/analyze`, `ai-debug/chat`, `ai-debug/[appName]/execute` | Chẩn đoán, chat, thực thi hành động đã duyệt |
| | `ai-debug/agent`, `ai-debug/agent/[id]`, `ai-debug/agent/[id]/apply` | Chế độ Agent: bắt đầu phiên, xem trạng thái và diff, áp dụng file đã chọn |
| Quản trị | `admin/users`, `admin/users/package`, `admin/impersonate` | Người dùng, gán gói, đăng nhập thay |
| | `admin/packages` | Tạo/sửa/xóa gói (áp lại giới hạn cho app đang chạy) |
| | `admin/telegram`, `admin/telegram/daily-report` | Token bot Telegram, gửi thử báo cáo hằng ngày |
| Nội bộ | `internal/telegram/directory` | Vibe Core lấy danh bạ người dùng, gói và chủ app (`X-API-Key`) |

---

## Cài đặt và chạy local

### Yêu cầu
- Node.js 20+
- PostgreSQL
- Một backend [Vibe Core](https://github.com/tobi1008/vibe-core) đang chạy
- (Tùy chọn) GitHub OAuth App

### Các bước

```bash
git clone https://github.com/tobi1008/vibehosting-FE.git
cd vibehosting-FE
npm install

# Tạo file .env (bảng bên dưới), rồi tạo bảng trong database
npx prisma db push

npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

Repo không dùng migration. Khi `prisma/schema.prisma` thay đổi, chạy `npx prisma db push` lên database **trước** khi triển khai bản frontend mới. Các thay đổi schema từ trước đến nay đều chỉ thêm bảng hoặc cột.

Sau khi thêm bảng `AppAllocation` lần đầu, chạy `node scripts/backfill-allocations.mjs` để xem trước, rồi thêm `--apply` để phân bổ tài nguyên cho các project cũ.

### Biến môi trường

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URL` | Có | Chuỗi kết nối PostgreSQL |
| `NEXTAUTH_SECRET` | Có | Khóa ký phiên đăng nhập (`openssl rand -base64 32`), cũng dùng để ký `state` OAuth. Có thể thay bằng `AUTH_SECRET`. |
| `NEXTAUTH_URL` | Có | URL gốc của dashboard, ví dụ `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | Có | Endpoint deploy của Vibe Core, dạng `https://<api-domain>/api/deploy` |
| `VIBE_API_KEY` | Có | Trùng với `VIBE_API_KEY` của Vibe Core |
| `GITHUB_WEBHOOK_SECRET` | Khuyến nghị | Trùng với `GITHUB_WEBHOOK_SECRET` của Vibe Core |
| `ADMIN_PASSWORD` | Khuyến nghị | Mật khẩu tài khoản `admin`, tạo tự động ở lần đăng nhập đầu |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Tùy chọn | GitHub OAuth App; callback là `<NEXTAUTH_URL>/api/user/github/callback` |

### Lệnh hữu ích

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Môi trường phát triển |
| `npm run build` | Sinh Prisma client và build production |
| `npm run start` | Chạy bản đã build |
| `npm run lint` | Kiểm tra lint |
| `npx tsc --noEmit` | Kiểm tra kiểu |

---

## Triển khai lên Vercel

1. Import repo vào Vercel (framework preset **Next.js**). Lệnh build `npm run build` đã gồm `prisma generate`.
2. Khai báo biến môi trường ở bảng trên cho **Production**, đánh dấu **Sensitive** cho các biến bí mật.
3. Mỗi lần push lên `main`, Vercel tự build và triển khai. Đổi biến môi trường thì cần **Redeploy**.
4. Khi thay đổi có liên quan tới backend, làm theo thứ tự:
   1. triển khai Vibe Core trước;
   2. chạy `prisma db push` nếu schema đổi;
   3. rồi mới push frontend.

---

## Giới hạn hiện tại và hướng phát triển

| Giới hạn | Hướng cải thiện |
|---|---|
| GitHub token của người dùng lưu trong database dạng văn bản thường. | Mã hóa trước khi lưu (ví dụ AES-GCM với khóa từ biến môi trường). |
| Tên app là định danh duy nhất toàn hệ thống, dùng chung cho dashboard và K3s. | Tách định danh nội bộ khỏi tên hiển thị, namespace theo người dùng. |
| Trạng thái triển khai suy ra từ log. | Nhận trạng thái có cấu trúc từ backend. |
| Gói chưa có hạn mức số lượt dùng AI. | Thêm hạn mức AI theo gói. |
| Chưa có migration, thay đổi schema dùng `prisma db push`. | Chuyển sang `prisma migrate` khi schema ổn định. |
| Chưa có bộ kiểm thử tự động cho frontend (backend có bộ pytest riêng). | Bổ sung unit test cho phân quyền, gói hosting và integration test cho các luồng triển khai. |
