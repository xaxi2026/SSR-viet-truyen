# SSR-viet-truyen — Việt hóa bản Hồ sơ cốt truyện Pilot (13/10/2026)

## Bản nguồn và máy thử

- Máy phát triển: `VCC-PHUONG23`.
- Nền Git: `feat/chatgpt-workspace-foundations-20261011` `e5f8beb7`; nhánh Pilot `feat/story-bible-20261013`.
- Có tính năng Hồ sơ cốt truyện tác giả từ commit `09425da` và bản Việt hóa cục bộ `04f4940`.
- Nhập thêm bộ `vi-narrative-threads.ts` và kiểm thử từ PR nháp GitHub #17 mà không lấy hoặc ghi đè `core.ts` từ GitHub.
- Những từ điển `vi-workflow-reviewed*.ts`, `vi-ui-patterns*.ts` bổ sung UI; không sửa ngôn ngữ sáng tác, prompt AI hay dữ liệu truyện.

## Kiểm tra đã thực hiện

- `node node_modules/typescript/bin/tsc --noEmit`: PASS.
- `node node_modules/eslint/bin/eslint.js . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`: PASS.
- `node scripts/check-i18n-coverage.mjs`: PASS. Công cụ này không chứng nhận dịch hết nội dung.
- `node node_modules/vitest/vitest.mjs run` với 5 tập thử giao diện/Story Bible: 17/17 PASS.
- `node node_modules/vite/bin/vite.js build`: PASS, sinh `dist/index.html`, `dist-electron/main.js`; còn cảnh báo Vite/deprecation.
- Hai bài kiểm tra repository SQLite qua Node bị **BLOCKED**: module `better-sqlite3` biên dịch cho Electron ABI 145 nhưng tiến trình Node kiểm thử cần ABI 137. **Không rebuild module trên bản Pilot đang vận hành**.
- Kiểm kê bằng AST chỉ trong JSX hai chuỗi tĩnh `text(zh,en)`: 1.386 lượt, thiếu dịch đúng 4 dấu phân cách. Có 188 template string động và 63 biểu thức động khác — một phần còn cần kiểm tra thực tế.
- **Chưa xác nhận GUI end-to-end hay bộ regression toàn dự án.** Không tuyên bố UI đã 100% tiếng Việt.

## Khởi động thử an toàn

- Desktop shortcut **SSR-viet truyen - Ho so cot truyen (Pilot)** giữ nguyên tên, trỏ tới `D:\SSR-NGHIA\Start SSR-viet truyen - Ho so cot truyen (Pilot).cmd`.
- CMD Pilot đã chuyển sang khởi chạy bản `electron.exe` và `dist` vừa build, **không gọi pnpm dev**, với profile riêng `D:\SSR-NGHIA\SSR-Pilot-StoryBible-Profile`.
- Bản lệnh phát triển cũ được giữ tại `D:\SSR-NGHIA\Start SSR-viet truyen - Ho so cot truyen (Pilot)-OLD-DEV.cmd`.
- Bản SSR cũ `D:\SSR-NGHIA\SSR-viet truyen` và launcher mặc định không thay đổi; không tác động dự án `test-1`.
- Khi có cảnh báo Kaspersky mới, dừng kiểm thử và đối chiếu báo cáo bảo mật; không tạo ngoại lệ antivirus.

## Chưa hoàn thành

1. Kiểm thử UI trên dự án thử riêng và xác nhận tất cả nhãn, các hộp thoại tiếng Việt theo ngữ cảnh.
2. Dịch 31 template động chưa bắt được bởi kiểm toán cũ (trước khi thêm bộ mẫu nguy hiểm), 63 biểu thức khác; rà JSX/placeholder chưa qua helper `text()`.
3. Kiểm tra SQLite integration trong môi trường test với native addon xây cho Node riêng, không sửa addon Electron đang chạy.
4. Nghiệm thu đóng gói Windows trước khi chuyển từ Pilot sang phiên bản mặc định.
5. Đồng bộ code qua GitHub bằng PR nháp, không tự merge.
