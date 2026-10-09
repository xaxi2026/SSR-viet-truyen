# SSR-viet truyen — Bộ tài liệu khởi động dự án

**Tên chính thức:** `SSR-viet truyen`  
**Repository:** [xaxi2026/SSR-viet-truyen](https://github.com/xaxi2026/SSR-viet-truyen) (fork chính thức)  
**Nền tảng phát triển:** [EthanYoQ/AI-Novel-Writer](https://github.com/EthanYoQ/AI-Novel-Writer) (upstream)

Mục tiêu: phát triển bản tiếng Việt của phần mềm desktop GPL-3.0 tại https://github.com/EthanYoQ/AI-Novel-Writer, giữ các chức năng gốc, bổ sung ngôn ngữ giao diện `vi-VN` và ngôn ngữ sáng tác `vi-VN`, rồi nâng cấp khả năng quản lý tiểu thuyết dài 300–1.000 chương.

## Trạng thái

Đây là **bộ đặc tả và hướng dẫn triển khai** đã được đưa vào nhánh phát triển của fork. Chưa phải bản phần mềm đã Việt hóa hay trình cài đặt. Nền tảng khảo sát: bản phát hành v1.1.0 (08/09/2026); khi thực thi phải kiểm tra commit/tag và CI mới nhất trước khi thay đổi. Chưa chạy kiểm thử ứng dụng gốc.

## Tài liệu

- `AGENTS.md`: chỉ dẫn cho Codex/agent khi làm việc trong repository.
- `docs/ROADMAP.md`: công việc theo giai đoạn và vùng mã nguồn cần khảo sát.
- `docs/VIETNAMESE_WRITING_SPEC.md`: yêu cầu bản địa hóa và sáng tác tiếng Việt.
- `docs/ACCEPTANCE_TESTS.md`: tiêu chí nghiệm thu và bộ thử nghiệm truyện dài.
- `docs/CHATGPT_BATCH_WRITING_SPEC.md`: thiết kế kỹ thuật lô chương 101–110 do ChatGPT sáng tác, checkpoint, memory, approval, MCP.
- `docs/BATCH_101_110_CONFIG.json`: cấu hình nghiệm thu tham chiếu; chưa phải dữ liệu chạy thật.

## Bắt đầu với repository thực

1. Fork dự án gốc trong tài khoản được chủ sở hữu cho phép; hoặc clone vào workspace riêng.
2. Ghim tag/commit upstream để kiểm thử có thể lặp lại. Không sửa trực tiếp `master` của upstream.
3. Sao chép `AGENTS.md` và `docs/` vào fork rồi lập Issue cho từng giai đoạn.
4. Cài Node.js >=20 và pnpm theo `packageManager` của repository (`pnpm@11.11.0` tại thời điểm khảo sát); cài dependencies bằng `pnpm install --frozen-lockfile`.
5. Kiểm tra baseline bằng `pnpm run typecheck`, `pnpm run check:i18n`, `pnpm test`, `pnpm run lint` trước khi chỉnh sửa.
6. Mọi bản sửa phải có automated tests và bằng chứng thử nghiệm GUI; build Windows `.exe` ở môi trường phù hợp với native Electron dependencies.

## Giấy phép

Giữ nguyên license GPL-3.0, copyright và attribution của tác giả gốc; khi phân phối phiên bản phái sinh phải đáp ứng các nghĩa vụ tương ứng. Không đặt tên/mô tả gây hiểu nhầm là bản chính thức do tác giả gốc phát hành.

## Mở rộng ChatGPT Batch Writing

Đã bổ sung thiết kế lô **101–110**, mỗi chương **2.500 đơn vị từ tiếng Việt**, chia **5 đợt × 2 chương**, AI tác giả là ChatGPT. Bản thảo phải lưu checkpoint, kiểm tra nhất quán và **chờ tác giả duyệt** trước khi định稿. Chi tiết xem `docs/CHATGPT_BATCH_WRITING_SPEC.md`. Tính năng này **chưa được lập trình** và chưa được kết nối vào ChatGPT.