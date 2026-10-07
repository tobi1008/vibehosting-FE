# 📑 BÁO CÁO TOÀN DIỆN DỰ ÁN VIBE HOSTING
### Cloud IDE, Nền Tảng Triển Khai Ứng Dụng Đa Kiến Trúc & Trợ Lý DevOps Tự Phục Hồi AI (AI DevOps Agent)

---

## 📌 MỤC LỤC
1. [Tổng Quan Dự Án & Công Nghệ](#1-tổng-quan-dự-án--công-nghệ)
2. [Kiến Trúc Hệ Thống & Luồng Tích Hợp](#2-kiến-trúc-hệ-thống--luồng-tích-hợp)
3. [Chi Tiết Tất Cả Các Phân Hệ Chức Năng](#3-chi-tiết-tất-cả-các-phân-hệ-chức-năng)
   - [3.1 Phân Hệ Xác Thực & Tài Khoản (Auth & Profile)](#31-phân-hệ-xác-thực--tài-khoản-auth--profile)
   - [3.2 Phân Hệ Quản Trị Hệ Thống (Admin & Impersonation)](#32-phân-hệ-quản-trị-hệ-thống-admin--impersonation)
   - [3.3 Phân Hệ Khởi Tạo & Triển Khai Dự Án (Deployment Wizard)](#33-phân-hệ-khởi-tạo--triển-khai-dự-án-deployment-wizard)
   - [3.4 Phân Hệ Trang Chủ & Quản Lý Dự Án (Dashboard)](#34-phân-hệ-trang-chủ--quản-lý-dự-án-dashboard)
   - [3.5 Phân Hệ Trình Quản Lý File & Monaco Code Editor](#35-phân-hệ-trình-quản-lý-file--monaco-code-editor)
   - [3.6 Phân Hệ Đẩy Mã Nguồn Lên GitHub Cá Nhân (Smart Push)](#36-phân-hệ-đẩy-mã-nguồn-lên-github-cá-nhân-smart-push)
   - [3.7 Phân Hệ AI Debug & Tự Phục Hồi (AI DevOps Agent - Dual Workflow)](#37-phân-hệ-ai-debug--tự-phục-hồi-ai-devops-agent---dual-workflow)
   - [3.8 Phân Hệ Giám Sát Log Thời Gian Thực (Logs Monitoring)](#38-phân-hệ-giám-sát-log-thời-gian-thực-logs-monitoring)
   - [3.9 Phân Hệ Cấu Hình & Tự Động Hóa CI/CD](#39-phân-hệ-cấu-hình--tự-động-hóa-cicd)
   - [3.10 Phân Hệ Lịch Sử Triển Khai & Khôi Phục (Deploy History & Rollback)](#310-phân-hệ-lịch-sử-triển-khai--khôi-phục-deploy-history--rollback)
4. [Bảng Tra Cứu API Toàn Diện (API Reference Matrix)](#4-bảng-tra-cứu-api-toàn-diện-api-reference-matrix)
5. [Cấu Hình Môi Trường & Triển Khai](#5-cấu-hình-môi-trường--triển-khai)

---

## 1. TỔNG QUAN DỰ ÁN & CÔNG NGHỆ

**Vibe Hosting** là nền tảng điện toán đám mây PaaS (Platform as a Service) thế hệ mới, kết hợp trải nghiệm của **Vercel** (triển khai nhanh), **Replit** (Cloud IDE Monaco chỉnh sửa code trực tiếp), **Portainer / K8s Dashboard** (giám sát Container Runtime Logs) và **AI DevOps Agent** (trợ lý DevOps tự động chẩn đoán lỗi, đọc log Pod và sinh mã sửa lỗi tự động).

### 🛠️ Tech Stack Chi Tiết:
- **Frontend Core**: Next.js 15 (App Router), React 19, TypeScript.
- **Styling & UI**: Tailwind CSS, Framer Motion (hiệu ứng mượt mà), Lucide Icons, Glassmorphism design tokens.
- **Cloud Code Editor**: `@monaco-editor/react` (Monaco Editor - nhân của VS Code) với theme `vs-dark`, dynamic syntax highlighting, dirty state tracking.
- **Authentication**: NextAuth.js v4 (Credentials Provider, JWT Session, Secret-based Token Signing).
- **Database & ORM**: SQLite / PostgreSQL qua Prisma ORM.
- **Git & DevOps Engine**: GitHub REST API (Octokit), Git Tree/Blob API, VPS Linux Remote Engine K3s/Kubernetes cluster.

---

## 2. KIẾN TRÚC HỆ THỐNG & LUỒNG TÍCH HỢP

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TRÌNH DUYỆT NGƯỜI DÙNG                          │
│     (Next.js Client: React 19, Monaco Editor, Framer Motion)           │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│             NEXT.JS APPLICATION SERVER (FRONTEND & BFF)                │
│ ┌──────────────────────────────┐    ┌────────────────────────────────┐ │
│ │  NextAuth & Prisma SQLite/PG │    │  Next.js API Routes Proxy      │ │
│ │  - Quản lý User, PAT, Profile│    │  - Điều phối API DevOps        │ │
│ │  - Admin Impersonate Session │    │  - Git Tree/Blob Sanitizer     │ │
│ └──────────────────────────────┘    └───────────────┬────────────────┘ │
└─────────────────────────────────────────────────────┼──────────────────┘
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
┌──────────────────────────────────────────────┐              ┌──────────────────────────────────────────────┐
│       REMOTE BACKEND DEVOPS ENGINE           │              │             GITHUB REST API v3               │
│         (http://116.118.50.199:8080)         │              │           (api.github.com)                   │
│ ┌──────────────────────────────────────────┐ │              │ ┌──────────────────────────────────────────┐ │
│ │ - /api/deploy, /api/deploy-with-db,...   │ │              │ │ - Tạo Blob, Tree, Commit, Ref            │ │
│ │ - /api/logs/{app}, /api/pod-logs/{app}   │ │              │ │ - Tự động tạo/fork repo mới              │ │
│ │ - /api/ai-debug/analyze                  │ │              │ │ - Đổi nhánh master -> main               │ │
│ │ - /api/ai-debug/chat                     │ │              │ └──────────────────────────────────────────┘ │
│ │ - /api/ai-debug/{app}/execute            │ │              └──────────────────────────────────────────────┘
│ └──────────────────────────────────────────┘ │
│                      ▲                       │
│                      │                       │
│ ┌────────────────────┴─────────────────────┐ │
│ │      K3S / KUBERNETES CLUSTER            │ │
│ │  - User App Pods (Frontend, Backend, DB) │ │
│ │  - AI DevOps Debug & Patching Agent     │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

---

## 3. CHI TIẾT TẤT CẢ CÁC PHÂN HỆ CHỨC NĂNG

---

### 3.1 Phân Hệ Xác Thực & Tài Khoản (Auth & Profile)

#### 1. Đăng ký tài khoản (`/register`)
- **Mô tả**: Cho phép người dùng tạo tài khoản mới với Username, Password, Họ tên và Email. Mật khẩu được mã hóa an toàn bằng `bcryptjs`.
- **API sử dụng**: `POST /api/auth/register`
- **Request Body**:
  ```json
  {
    "username": "tobi1008",
    "password": "secure_password_123",
    "name": "Tobi Dev",
    "email": "tobi@example.com"
  }
  ```
- **Response**: `{ "success": true, "user": { "id": "...", "username": "tobi1008" } }`

#### 2. Đăng nhập hệ thống (`/login`)
- **Mô tả**: Đăng nhập qua NextAuth Credentials Provider. Cấp JWT token lưu session trên cookie HTTPOnly. Hỗ trợ chuyển hướng tự động khi hết hạn hoặc khi mở trang yêu cầu quyền đăng nhập.
- **API sử dụng**: NextAuth internal `POST /api/auth/callback/credentials`

#### 3. Quản lý Hồ sơ & Kết nối GitHub (`/profile`)
- **Mô tả**: Cho phép xem thông tin cá nhân, cập nhật GitHub Personal Access Token (PAT), xem avatar GitHub và danh sách repository cá nhân.
- **API sử dụng**:
  - `GET /api/user/profile`: Lấy thông tin tài khoản hiện tại.
  - `PUT /api/user/profile`: Cập nhật Họ tên, Email, Mật khẩu mới.
  - `POST /api/user/github`: Lưu hoặc cập nhật GitHub PAT (kiểm tra tính hợp lệ của token qua GitHub API).
  - `GET /api/user/github/repos`: Lấy danh sách repository của tài khoản GitHub được liên kết.

---

### 3.2 Phân Hệ Quản Trị Hệ Thống (Admin & Impersonation)

#### 1. Quản lý người dùng (`/admin/users`)
- **Mô tả**: Dành riêng cho tài khoản có `role = "admin"`. Xem danh sách toàn bộ người dùng, số lượng dự án đã tạo, thời điểm đăng ký, tạo người dùng mới hoặc thay đổi mật khẩu.
- **API sử dụng**:
  - `GET /api/admin/users`: Lấy danh sách users kèm `_count.projects`.
  - `POST /api/admin/users`: Tạo user mới từ dashboard Admin.
  - `PATCH /api/admin/users`: Đổi mật khẩu hoặc cập nhật quyền (role).

#### 2. Tính năng "Đăng nhập với tư cách người dùng" (Impersonate User)
- **Mô tả**: Admin có thể bấm nút **"Đăng nhập dưới quyền"** ở bất kỳ người dùng nào để vào xem dự án, log và file của người đó mà không cần biết mật khẩu. Thanh Navbar sẽ hiển thị dải Banner cảnh báo màu vàng cùng nút **[Quay lại tài khoản Admin]**.
- **API sử dụng**:
  - `POST /api/admin/impersonate`:
    - Request Body: `{ "userId": "target_user_id" }`
    - Logic: Sinh token ký bí mật chuyển đổi Session sang user đích, lưu lại `originalAdminId`.
  - `DELETE /api/admin/impersonate`:
    - Khôi phục Session trở lại tài khoản Admin ban đầu.

---

### 3.3 Phân Hệ Khởi Tạo & Triển Khai Dự Án (Deployment Wizard)

**Đường dẫn**: `/new`

#### 1. Bốn Chế độ Kiến trúc (Architecture Modes)
1. **Web Only (`web_only`)**: Triển khai web app đơn lẻ (Next.js, React, Vue, Node.js, Python Flask, v.v.).
2. **Web + Database (`web_db`)**: Triển khai ứng dụng kèm 1 trong 5 hệ quản trị cơ sở dữ liệu (MySQL, MariaDB, PostgreSQL, MongoDB, Redis). Hỗ trợ upload file backup khởi tạo (`.sql`, `.dump`, `.rdb`).
3. **Fullstack 2 Repos (`fullstack`)**: Triển khai riêng biệt 2 repository (Backend và Frontend), tự động cấp 2 tên miền hoặc subdomain tương ứng.
4. **Monorepo (`monorepo`)**: Triển khai dự án chứa cả Backend và Frontend trong cùng 1 repository với các subfolder riêng.

#### 2. Luồng Gọi API Triển Khai
Tùy vào chế độ kiến trúc được chọn, Frontend gọi các endpoint tương ứng trên Remote Backend (`http://116.118.50.199:8080`):

- **Chế độ Web Only**:
  - `POST /api/deploy`
  - Body: `{ "repo_url": "...", "app_name": "...", "app_domain": "...", "branch": "main" }`
- **Chế độ Web + Database**:
  - `POST /api/deploy-with-db` (Multipart Form-Data nếu có upload file SQL/Dump hoặc JSON)
  - Body Fields: `repo_url`, `app_name`, `app_domain`, `db_type`, `db_name`, `db_user`, `db_password`, `db_file`.
- **Chế độ Fullstack (2 Repos)**:
  - `POST /api/deploy-fullstack`
  - Body:
    ```json
    {
      "app_name": "shop3t",
      "be_repo_url": "https://github.com/...",
      "fe_repo_url": "https://github.com/...",
      "be_domain": "shop3t-api.vibehost.site",
      "fe_domain": "shop3t.vibehost.site"
    }
    ```
- **Chế độ Monorepo**:
  - `POST /api/deploy-monorepo`
  - Body: `{ "repo_url": "...", "app_name": "...", "be_path": "backend", "fe_path": "frontend", ... }`

#### 3. Đồng bộ Dữ liệu vào Database & Stream Log Triển Khai
- Sau khi kích hoạt deploy, Frontend lưu dự án vào cơ sở dữ liệu qua `POST /api/projects`.
- Bật màn hình Live Terminal tự động scroll và polling liên tục qua `GET /api/logs/{appName}` để hiển thị tiến trình build Docker, kéo image và tạo Pod K8s.

---

### 3.4 Phân Hệ Trang Chủ & Quản Lý Dự Án (Dashboard)

**Đường dẫn**: `/`

#### 1. Tính năng hiển thị danh sách dự án
- Hiển thị danh sách card ứng dụng với đầy đủ thông tin: Tên app, Domain, Repo URL, Thời gian tạo, Badge trạng thái (`deploying` [vàng], `active` [xanh], `failed` [đỏ]).
- Tự động polling trạng thái định kỳ và kiểm tra tình trạng log runtime từ cụm.

#### 2. Các Action nhanh trên từng dự án:
- **Mở ứng dụng**: Bấm mở URL domain trên tab mới.
- **Xem log nhanh (Modal Quick Logs)**: Bấm icon Terminal để mở modal xem 200 dòng runtime log gần nhất.
- **Khởi động lại Pod (Restart)**: Gọi `POST /api/apps/{appName}/redeploy`.
- **Xóa dự án (Delete Project)**: Xóa Pod và tài nguyên trên VPS, đồng thời xóa record khỏi cơ sở dữ liệu qua `DELETE /api/projects?id={projectId}`.

---

### 3.5 Phân Hệ Trình Quản Lý File & Monaco Code Editor

**Đường dẫn**: `/project/[name]` (Tab `Mã nguồn`)  
**Component**: [CodeEditorTab.tsx](file:///Users/tobi/devops/vibehosting/frontend/src/components/FileManager/CodeEditorTab.tsx)

#### 1. Bố cục Split-View (25% Tree View - 75% Monaco Editor)
- **Cột trái (25%) - Cây thư mục**:
  - Tự động phân luồng cây thư mục thành 2 gốc: `📁 backend` và `📁 frontend` đối với dự án Fullstack 2-repo.
  - Icon phân loại chuyên nghiệp theo từng đuôi file (`.ts`, `.tsx`, `.js`, `.json`, `.sql`, `.env`, `.yml`, `.css`, v.v.).
  - Thanh bộ lọc nhanh: `[ Tất cả ]`, `[ Frontend ]`, `[ Backend ]`.
  - Hiển thị chấm tròn cam/đỏ (Dirty indicator) khi file đang có thay đổi chưa lưu.
- **Cột phải (75%) - Monaco Code Editor**:
  - Tích hợp Monaco Editor với theme `vs-dark`, nhận diện đúng ngôn ngữ lập trình theo phần mở rộng của file.
  - Action Bar phía trên: Breadcrumb file, trạng thái lưu, nút `[💾 Lưu thay đổi]` (`Ctrl + S`), và nút `[🚀 Push to GitHub]`.
  - Xử lý file nhị phân (Binary): Báo lỗi nhẹ nhàng và hiển thị giao diện thông báo nếu người dùng click vào ảnh (`.png`, `.jpg`), file nén, hoặc font chữ.
  - Modal cảnh báo mất dữ liệu (Unsaved changes guard) khi click chuyển file khác trong lúc chưa lưu.

#### 2. Các API quản lý File:
1. **Lấy cấu trúc thư mục (File Tree)**:
   - `GET /api/project/{name}/files`
   - Response:
     ```json
     {
       "status": "success",
       "tree": [
         { "name": "src", "path": "src", "type": "directory", "children": [...] },
         { "name": "package.json", "path": "package.json", "type": "file", "size": 1204 }
       ]
     }
     ```
2. **Đọc nội dung 1 file**:
   - `GET /api/project/{name}/file?path=src/index.ts`
   - Response: `{ "status": "success", "path": "src/index.ts", "content": "..." }`
3. **Lưu nội dung chỉnh sửa**:
   - `PUT /api/project/{name}/file`
   - Body: `{ "path": "src/index.ts", "content": "const a = 1;..." }`
   - Response: `{ "status": "success", "message": "File đã được lưu thành công" }`

---

### 3.6 Phân Hệ Đẩy Mã Nguồn Lên GitHub Cá Nhân (Smart Push)

**Modal**: [PushToGithubModal.tsx](file:///Users/tobi/devops/vibehosting/frontend/src/components/FileManager/PushToGithubModal.tsx)  
**API Route**: [route.ts](file:///Users/tobi/devops/vibehosting/frontend/src/app/api/project/%5Bname%5D/github/push/route.ts)

#### 1. Tính năng nổi bật của Smart Push:
- **Tự động lưu PAT**: Lưu GitHub Personal Access Token vào `localStorage` (`vibe_github_pat`) và tự động nạp lại ở các lần sau.
- **Tự động Fork / Tạo mới Repo**: Nếu tài khoản GitHub chưa có repository mang tên đó, hệ thống tự động tạo repo mới và đẩy toàn bộ code lên.
- **Tự động đổi nhánh master -> main**: Luôn tạo nhánh mặc định là `main` theo quy chuẩn mới nhất của GitHub.
- **Tự động bảo vệ bí mật (Secret Protection Guard)**: Tự động loại trừ các file `.env`, `.env.local` chứa khóa bí mật nguy hiểm để tránh vi phạm chính sách *Push Protection* của GitHub.
- **Chuẩn hóa đường dẫn Git Tree**: Tự động loại bỏ dấu gạch chéo đầu dòng (`leading slash`) để ngăn lỗi `tree.path cannot start with a slash`.
- **Tự động Rebuild CI/CD**: Khi checkbox `[x] Tự động kích hoạt Rebuild & Redeploy ứng dụng` được tick, sau khi push thành công lên GitHub, hệ thống ngầm gọi ngay `POST /api/apps/{appName}/redeploy`.

#### 2. Chi tiết API Smart Push:
- `POST /api/project/{appName}/github/push`
- **Request Body**:
  ```json
  {
    "githubToken": "ghp_xxxxxxxxxxxxxxxxxxxx",
    "commitMessage": "Cập nhật logic sửa lỗi CORS từ Vibe Cloud IDE",
    "component": "be",
    "customRepoName": "my-custom-backend",
    "autoRebuild": true
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "message": "Đẩy mã nguồn lên GitHub thành công!",
    "url": "https://github.com/tobi1008/my-custom-backend/tree/main",
    "commit_sha": "7f8b9c2...",
    "is_new_repo": true
  }
  ```

---

### 3.7 Phân Hệ AI Debug & Tự Phục Hồi (AI DevOps Agent - Dual Workflow)

**Đường dẫn**: `/project/[name]` (Tab `AI Debug & Tự phục hồi`)  
**Component**: [AiDebugTab.tsx](file:///Users/tobi/devops/vibehosting/frontend/src/components/AiDebug/AiDebugTab.tsx)

Hệ thống AI Debug được xây dựng với kiến trúc **Dual-Workflow** 2 phân hệ độc lập:

```
┌────────────────────────────────────────────────────────────────────────┐
│  AI DEBUG & TỰ PHỤC HỒI                                                │
│  [📊 Dashboard Chẩn đoán & Sửa lỗi]    [💬 Khung Chat với AI DevOps Agent (Mới)] │
└────────────────────────────────────────────────────────────────────────┘
```

#### 1. Phân hệ 1: Dashboard Chẩn đoán & Danh sách Action
- **Kích hoạt chẩn đoán**: Người dùng chọn Component (`be` / `fe`), có thể nhập ghi chú mô tả triệu chứng lỗi (tùy chọn) và bấm `[⚡ AI DevOps Agent Phân tích sự cố]`.
- **API Chẩn đoán**: Gọi `POST /api/ai-debug/analyze`:
  - Request Body: `{ "app_name": "3tshop", "component": "be", "user_note": "...", "auto_apply": false }`
- **Live Terminal Console (ai-devops-agent@k3s)**: Hiển thị 5 bước tự động:
  1. Kết nối K3s & Pod
  2. Đọc Runtime Logs
  3. Quét Environment
  4. AI DevOps Agent Reasoning
  5. Sinh Action Items
- **Thẻ Chẩn đoán (Diagnosis Card)**:
  - Badge màu đỏ đậm hiển thị mã nguyên nhân gốc: `root_cause` (vd: `CORS_CONFIG_MISSING`, `PORT_MISMATCH`).
  - Khối phân tích chi tiết: `diagnosis` và giải pháp kiến nghị: `suggested_solution`.
- **Danh sách Action Items Checklist**:
  - 🔵 `edit_file`: Sửa mã nguồn (có accordion xem code diff trước/sau).
  - 🟠 `exec_pod`: Chạy lệnh Shell trong Pod (xem câu lệnh bash).
  - 🟣 `set_env`: Bơm biến môi trường K8s (xem danh sách key-value).
  - ⚪ `restart_deployment`: Khởi động lại Pod.
- **Thực thi các hành động**: Nút `[🚀 Áp dụng các hành động đã chọn ({n})]` gọi:
  - `POST /api/ai-debug/{appName}/execute`
  - Body: `{ "actions": [ { "action_type": "edit_file", ... } ] }`
  - Hiển thị kết quả thực thi và output terminal từng bước.
- **Nút chuyển nhanh**: *"💬 Hỏi cặn kẽ trong Khung Chat"* giúp chuyển sang Tab 2 mà không làm mất dữ liệu chẩn đoán hiện tại.

#### 2. Phân hệ 2: Khung Chat với AI DevOps Agent (Đàm thoại & Thảo luận)
- **Mục đích**: Người dùng có thể chất vấn, hỏi cặn kẽ nguyên nhân vì sao lỗi xảy ra, tại sao lại phải sửa file đó trước khi quyết định bấm Action.
- **API Đàm thoại**: Gọi `POST /api/ai-debug/chat`:
  - Request Body:
    ```json
    {
      "app_name": "3tshop",
      "component": "be",
      "message": "Tôi thấy log báo lỗi CORS, bạn giải thích kỹ hơn được không?",
      "history": [
        { "role": "user", "content": "Kiểm tra log giúp tôi" },
        { "role": "assistant", "content": "Log của bạn đang báo lỗi CORS do thiếu header Access-Control-Allow-Origin..." }
      ]
    }
    ```
  - Response:
    ```json
    {
      "status": "success",
      "reply": "Lỗi CORS xảy ra do domain frontend của bạn (shop3t.vibehost.site) không nằm trong danh sách allowed origins của Backend..."
    }
    ```
- **Điểm mạnh kỹ thuật**:
  - **Dynamic Pod Log Context**: Mỗi lần người dùng gửi tin nhắn, AI DevOps Agent phía Backend ngầm đọc lại Pod log mới nhất từ K8s để đưa ra nhận định chính xác theo thời gian thực.
  - **Giữ nguyên trạng thái (State Preservation)**: Chat liên tục qua lại mà không gây reload trang hay mất danh sách hành động ở Dashboard.
  - **Quick Suggestion Chips**: Bấm hỏi nhanh các câu hỏi mẫu (CORS, CrashLoopBackOff, giải thích diff, đọc lại log).
  - **Action Reminder Banner**: Hiển thị banner nhắc nhở quay lại Dashboard thực thi khi đã có giải pháp.

---

### 3.8 Phân Hệ Giám Sát Log Thời Gian Thực (Logs Monitoring)

#### 1. Tab "Container Runtime Logs"
- **API**: Gọi `GET /api/pod-logs/{appName}?component={all|be|fe}&lines=200`
- **Component Filter**: Chuyển đổi nhanh 3 chế độ:
  - `[ Toàn bộ ]`: Xem log tổng hợp của cụm ứng dụng.
  - `[ Backend Pod ]`: Xem riêng log Pod backend.
  - `[ Frontend Pod ]`: Xem riêng log Pod frontend.
- **Công cụ hỗ trợ**: Tìm kiếm log (Filter string), Tạm dừng/Tiếp tục auto-scroll, Copy toàn bộ log vào clipboard.
- **Pod Override Guard**: Cho phép chỉ định thủ công tên Pod hoặc tự động nhận diện tên Pod chính xác đang chạy trên cụm K3s.

#### 2. Tab "Build Logs"
- **API**: Gọi `GET /api/logs/{appName}`
- Hiển thị toàn bộ quá trình đóng gói Docker, Git clone, cài đặt dependencies và compile artifacts.

---

### 3.9 Phân Hệ Cấu Hình & Tự Động Hóa CI/CD

**Đường dẫn**: `/project/[name]` (Tab `Cài đặt & CI/CD`)  
**Component**: [ProjectCicdSettings.tsx](file:///Users/tobi/devops/vibehosting/frontend/src/components/ProjectCicdSettings.tsx)

#### 1. Quản lý Biến Môi Trường (Environment Variables)
- Cho phép thêm, xóa, sửa các cặp `KEY=VALUE`.
- Chế độ ẩn/hiện giá trị nhạy cảm (Password/Tokens).
- Bơm trực tiếp vào Deployment Pod của Kubernetes.

#### 2. Tự Động Hóa CI/CD & Redeploy
- Cấu hình Webhook GitHub: Tự động trigger build và deploy khi có commit mới đẩy vào nhánh chính.
- Nút **[Khởi động lại / Re-deploy]**: Gọi `POST /api/apps/{appName}/redeploy` để kích hoạt rolling update container mà không gây downtime.

---

### 3.10 Phân Hệ Lịch Sử Triển Khai & Khôi Phục (Deploy History & Rollback)

**Đường dẫn**: `/project/[name]` (Tab `Lịch sử Triển khai`)  
**Component**: [DeployHistoryTab.tsx](file:///Users/tobi/devops/vibehosting/frontend/src/components/DeployHistory/DeployHistoryTab.tsx)

#### 1. Bộ Chọn Thành Phần Đa Kiến Trúc (Component Selector)
- Với dự án **Fullstack 2-repo**, cung cấp Segmented Control: `[ Backend (be) ]` và `[ Frontend (fe) ]` để người dùng chọn xem lịch sử của từng thành phần.
- Với dự án **Single Repo (Web Only / Monorepo)**, tự động ẩn bộ chọn để giao diện gọn gàng.

#### 2. Danh Sách Lịch Sử Phiên Bản (Timeline View)
- Sắp xếp từ phiên bản mới nhất đến cũ nhất.
- Đánh dấu Badge nổi bật `🟢 Phiên bản Hiện tại` cho Revision cao nhất đang xử lý lưu lượng truy cập.
- **Hiển thị Ngày & Giờ Triển Khai**: Mỗi phiên bản hiển thị đầy đủ thời gian `HH:mm:ss - DD/MM/YYYY` kèm thời gian tương đối `(X phút trước, X giờ trước...)` với icon Calendar/Clock.
- Hiển thị chi tiết nguyên nhân cập nhật (`cause`: ví dụ *"Bản cập nhật tự động (CI/CD / Image Update)"*).
- Nút `[ ⏪ Khôi phục về bản này ]` ở các bản phát hành cũ (ẩn/disable ở bản hiện tại).

#### 3. Quy Trình Khôi Phục An Toàn (Safe Rollback Flow)
- **Modal Xác nhận**: Cảnh báo *"Bạn có chắc chắn muốn khôi phục [Backend/Frontend] về [Phiên bản #X]? Ứng dụng sẽ bị gián đoạn khoảng 2 giây để chuyển đổi traffic."*
- **Trạng thái Loading & Khóa Màn hình**: Hiển thị spinner và vô hiệu hóa nút bấm để chống double-click.
- **Tự động Đồng bộ**: Sau khi rollback thành công (chỉ mất 2-3 giây), tự động nạp lại lịch sử mới nhất từ K8s và hiển thị Toast màu xanh.
- **Empty State**: Bắt lỗi `404 Not Found` thân thiện khi ứng dụng mới chưa có lịch sử.

---

## 4. BẢNG TRA CỨU API TOÀN DIỆN (API REFERENCE MATRIX)

| STT | Phân Hệ | Phương Thức | Endpoint URL | Gọi Từ Component / File | Body / Query Params | Mô Tả Chức Năng |
|:---:|:---|:---:|:---|:---|:---|:---|
| **1** | Auth | `POST` | `/api/auth/register` | `src/app/register/page.tsx` | Body: `{ username, password, name, email }` | Đăng ký tài khoản mới, mã hóa mật khẩu bcrypt |
| **2** | Auth | `POST` | `/api/auth/callback/credentials` | `src/app/login/page.tsx` | Body: `{ username, password }` | Đăng nhập NextAuth, cấp phát JWT Session |
| **3** | Profile | `GET` | `/api/user/profile` | `src/app/profile/page.tsx` | Không | Lấy thông tin user, email, ngày tạo, kết nối GitHub |
| **4** | Profile | `PUT` | `/api/user/profile` | `src/app/profile/page.tsx` | Body: `{ name, email, newPassword }` | Cập nhật thông tin hồ sơ và mật khẩu |
| **5** | Profile | `POST` | `/api/user/github` | `src/app/profile/page.tsx`, `PushToGithubModal.tsx` | Body: `{ token }` | Lưu GitHub Personal Access Token (PAT) |
| **6** | Profile | `GET` | `/api/user/github/repos` | `src/app/new/page.tsx` | Không | Lấy danh sách GitHub Repositories của tài khoản |
| **7** | Admin | `GET` | `/api/admin/users` | `src/app/admin/users/page.tsx` | Không (Yêu cầu role admin) | Xem danh sách tất cả user trong hệ thống |
| **8** | Admin | `POST` | `/api/admin/users` | `src/app/admin/users/page.tsx` | Body: `{ username, password, name, role }` | Tạo tài khoản user mới từ phía Admin |
| **9** | Admin | `PATCH` | `/api/admin/users` | `src/app/admin/users/page.tsx` | Body: `{ userId, password, role }` | Cập nhật quyền hoặc reset mật khẩu của user |
| **10** | Admin | `POST` | `/api/admin/impersonate` | `src/app/admin/users/page.tsx` | Body: `{ userId }` | Đăng nhập mạo danh vào tài khoản user đích |
| **11** | Admin | `DELETE`| `/api/admin/impersonate` | `src/components/Navbar.tsx` | Không | Thoát phiên impersonate, trở lại tài khoản Admin |
| **12** | Project | `GET` | `/api/projects` | `src/lib/ProjectContext.tsx` | Không | Lấy danh sách dự án của user hiện tại |
| **13** | Project | `POST` | `/api/projects` | `src/lib/ProjectContext.tsx` | Body: `{ app_name, repo_url, app_domain, ... }` | Lưu metadata dự án mới vào cơ sở dữ liệu |
| **14** | Project | `DELETE`| `/api/projects?id={id}` | `src/lib/ProjectContext.tsx` | Query: `id={projectId}` | Xóa vĩnh viễn dự án khỏi database và K8s |
| **15** | Deploy | `POST` | `/api/deploy` | `src/app/new/page.tsx` | Body: `{ repo_url, app_name, app_domain }` | Triển khai ứng dụng Web Only |
| **16** | Deploy | `POST` | `/api/deploy-with-db` | `src/app/new/page.tsx` | FormData: `repo_url, app_name, db_type, db_file...` | Triển khai ứng dụng Web kèm Cơ sở dữ liệu |
| **17** | Deploy | `POST` | `/api/deploy-fullstack` | `src/app/new/page.tsx` | Body: `{ app_name, be_repo_url, fe_repo_url, ... }` | Triển khai ứng dụng Fullstack 2-repo (FE & BE) |
| **18** | Deploy | `POST` | `/api/deploy-monorepo` | `src/app/new/page.tsx` | Body: `{ repo_url, app_name, be_path, fe_path }` | Triển khai ứng dụng dạng Monorepo |
| **19** | Logs | `GET` | `/api/logs/{appName}` | `src/app/project/[name]/page.tsx` | Không | Lấy Build Logs quá trình đóng gói Docker |
| **20** | Logs | `GET` | `/api/pod-logs/{appName}` | `src/app/project/[name]/page.tsx` | Query: `?component=all\|be\|fe&lines=200` | Lấy Runtime Logs của Pod Kubernetes |
| **21** | File | `GET` | `/api/project/{name}/files` | `src/components/FileManager/CodeEditorTab.tsx` | Không | Lấy cây thư mục mã nguồn dự án |
| **22** | File | `GET` | `/api/project/{name}/file` | `src/components/FileManager/CodeEditorTab.tsx` | Query: `?path={filePath}` | Đọc nội dung file văn bản trong mã nguồn |
| **23** | File | `PUT` | `/api/project/{name}/file` | `src/components/FileManager/CodeEditorTab.tsx` | Body: `{ path, content }` | Lưu đè nội dung file sau khi chỉnh sửa |
| **24** | Git | `POST` | `/api/project/{name}/github/push` | `PushToGithubModal.tsx` | Body: `{ githubToken, commitMessage, component... }` | Đẩy mã nguồn trực tiếp lên GitHub cá nhân |
| **25** | AI Debug | `POST` | `/api/ai-debug/analyze` | `src/components/AiDebug/AiDebugTab.tsx` | Body: `{ app_name, component, user_note }` | AI DevOps Agent phân tích lỗi K8s và sinh Action Items |
| **26** | AI Debug | `POST` | `/api/ai-debug/chat` | `src/components/AiDebug/AiDebugTab.tsx` | Body: `{ app_name, component, message, history }` | Chat đàm thoại với AI DevOps Agent, đọc log mới nhất |
| **27** | AI Debug | `POST` | `/api/ai-debug/{appName}/execute` | `src/components/AiDebug/AiDebugTab.tsx` | Body: `{ actions: [...] }` | Thực thi các hành động sửa lỗi đã chọn lên K8s |
| **28** | CI/CD | `GET` | `/api/projects/{name}/cicd` | `src/components/ProjectCicdSettings.tsx` | Không | Lấy cấu hình biến môi trường & nhánh git |
| **29** | CI/CD | `POST` | `/api/projects/{name}/cicd` | `src/components/ProjectCicdSettings.tsx` | Body: `{ envVars: { ... }, branch, autoDeploy }` | Cập nhật cấu hình biến môi trường và CI/CD |
| **30** | CI/CD | `POST` | `/api/apps/{name}/redeploy` | `src/components/ProjectCicdSettings.tsx` | Không | Kích hoạt rolling update / redeploy ứng dụng |
| **31** | History | `GET` | `/api/apps/{name}/history` | `src/components/DeployHistory/DeployHistoryTab.tsx` | Query: `?component=be\|fe` (nếu Fullstack) | Lấy danh sách lịch sử Revisions triển khai trên K8s |
| **32** | Rollback | `POST` | `/api/apps/{name}/rollback` | `src/components/DeployHistory/DeployHistoryTab.tsx` | Body: `{ component, revision }` | Kích hoạt Rollback về phiên bản cũ (2-3 giây) |

---

## 5. CẤU HÌNH MÔI TRƯỜNG & TRIỂN KHAI

### Các biến môi trường chính (`.env` / `docker-compose.yml`):
```ini
# Cổng chạy ứng dụng Frontend
PORT=3000

# Khóa bảo mật phiên NextAuth
NEXTAUTH_SECRET=vibehosting_super_secret_jwt_key_2026

# URL ứng dụng Frontend (NextAuth Callback)
NEXTAUTH_URL=http://localhost:3000

# Địa chỉ Remote Backend DevOps Engine trên VPS
NEXT_PUBLIC_API_URL=http://116.118.50.199:8080/api/deploy

# Chuỗi kết nối cơ sở dữ liệu lưu trữ người dùng & dự án
DATABASE_URL=file:./dev.db
```

### Khởi chạy môi trường:
```bash
# Khởi động cụm container Docker
docker compose up -d

# Kiểm tra trạng thái container
docker ps

# Kiểm tra typecheck
docker exec vibehosting-frontend-1 npx tsc --noEmit
```

---

> 📄 **Báo cáo này được tự động cập nhật và đồng bộ với toàn bộ tính năng mã nguồn của dự án Vibe Hosting.**
