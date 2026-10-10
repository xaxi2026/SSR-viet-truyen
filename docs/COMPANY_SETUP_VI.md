# Tiếp tục SSR-viet truyen trên máy công ty (Windows)

## Điều cần biết trước

GitHub chứa **mã nguồn**, không chứa database và truyện thử `test-1`. Bạn có thể cài ứng dụng ở công ty dù laptop ở nhà đã tắt, nhưng `test-1` sẽ không tự xuất hiện. Chỉ chuyển bản sao dữ liệu khi được phép theo quy định của công ty, qua phương thức an toàn được duyệt; không commit `.vela` hoặc truyện riêng vào repository công khai.

Các yêu cầu: Windows 10/11, Git for Windows, Node.js phiên bản tương thích `package.json` (máy nhà đang dùng Node 24), Corepack/pnpm. Máy công ty `VCC-PHUONG23` đã có Node.js và Remote Desktop Commander tại thời điểm kiểm tra, nhưng lệnh Git chưa có trên PATH.

## Cài mã nguồn

Mở **PowerShell** trên máy công ty, sau khi đã cài Git và kiểm tra:

```powershell
git --version
node --version
corepack --version

# Chọn thư mục được phép ghi tại máy công ty; ví dụ này dùng thư mục người dùng
mkdir "$env:USERPROFILE\Documents\SSR-dev" -Force
cd "$env:USERPROFILE\Documents\SSR-dev"
git clone -b feat/story-bridge-v2-architecture https://github.com/xaxi2026/SSR-viet-truyen.git
cd SSR-viet-truyen
corepack pnpm install
corepack pnpm run typecheck
corepack pnpm dev
```

Nếu Git chưa có, bạn có thể cài **Git for Windows** từ trang chính thức https://git-scm.com/downloads/win (theo quyền và chính sách IT); đóng/mở lại PowerShell sau khi cài. Không chạy lệnh cài đặt từ nguồn không rõ.

## Khi muốn cập nhật mã ngày hôm sau

```powershell
cd "$env:USERPROFILE\Documents\SSR-dev\SSR-viet-truyen"
git fetch origin
git switch feat/story-bridge-v2-architecture
git pull --ff-only
corepack pnpm install
corepack pnpm dev
```

Giữ bản nhánh `feat/story-bridge-v2-architecture` là nhánh tích hợp **chưa merge** cho tới khi có xác nhận review. Nếu sau này PR được merge vào nhánh chính, hãy làm theo tài liệu cập nhật.

## Nếu muốn kiểm thử với đúng dự án test-1

Chỉ chuyển dữ liệu từ `D:\SSR-truyen test\test-1` sang máy công ty khi được phép và ứng dụng không chạy. Sao chép toàn bộ thư mục dự án (bao gồm `.vela`) qua phương thức lưu trữ an toàn, không gửi vào GitHub công khai; dùng bản **sao** để thử, không phá dữ liệu gốc. Nên kiểm tra DB SQLite trước và sau khi chép, và mở qua chức năng **Mở dự án** trong phần mềm.

## Câu lệnh tiếp tục với ChatGPT

> Tiếp tục SSR-viet truyen theo docs/DEV_HANDOFF.md và docs/SSR_STORY_BRIDGE_V2.md trên branch feat/story-bridge-v2-architecture. Hãy kiểm tra repo, chạy test và hoàn thiện các phần còn lại một lượt; không ghi đè dữ liệu test-1 khi chưa được tôi duyệt.
