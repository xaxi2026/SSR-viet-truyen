# SSR Story Bridge v1 — Quy trình duyệt đề xuất

## Đã triển khai

SSR Story Bridge v1 bổ sung ba lựa chọn xử lý và lịch sử đề xuất, trên nền v0:

1. **Áp dụng vào biểu mẫu:** chỉ cập nhật dữ liệu chỉnh sửa của ứng dụng. Bạn cần bấm **Lưu** ở màn hình **Cấu hình truyện**.
2. **Xác nhận đã lưu:** Electron kiểm tra trực tiếp bảng `project_core` trong SQLite đang mở; **tất cả các trường** của đề xuất phải đúng với nội dung đã lưu. Nếu không khớp, ứng dụng từ chối ghi nhận đã chấp nhận và giữ đề xuất chờ.
3. **Từ chối:** cần xác nhận trên giao diện; lưu trạng thái từ chối vào lịch sử. Không xóa dữ liệu chính thức đang có.
4. **Yêu cầu sửa:** yêu cầu phản hồi có nội dung, lưu phản hồi và nội dung đề xuất vào lịch sử. ChatGPT có thể đọc lại phản hồi và tạo bản kế tiếp.
5. **Lịch sử:** hiển thị 30 lần xử lý gần nhất; giữ nội dung từng đề xuất dưới `.vela/story-bridge/history/<proposalId>.json`.

## An toàn dữ liệu

- Các thao tác lịch sử qua hai kênh `story-bridge:resolve` / `story-bridge:history` được kiểm tra quyền bởi `ProjectAccess` và **lease của dự án hiện hành**, cùng loại bảo vệ đã dùng cho thao tác dự án khác.
- Mã đề xuất phải là UUID; chỉ chấp nhận status `accepted`, `rejected`, `revision_requested`.
- Khi chấp nhận, so khớp chính xác tất cả các nội dung đề xuất với SQLite đã được **lưu trên đĩa**. Trình duyệt không thể tự xác nhận bằng dữ liệu biểu mẫu chưa lưu.
- Archive được ghi theo tên riêng bằng chế độ độc quyền `wx` và `fsync` trước khi xóa pending. Nếu quá trình bị ngắt sau khi archive, xử lý lại cùng ID và trạng thái sẽ hoàn tất việc dọn pending mà không tạo receipt trùng.
- Không thay đổi bảng `project_core` khi Chấp nhận, Từ chối hay Yêu cầu sửa. Chỉ nút Lưu riêng của SSR-viet truyen mới ghi nội dung.
- Phần mềm từ chối đường dẫn history/pending đi qua symlink/junction ra ngoài dự án và từ chối tệp kích thước quá lớn.
- Mỗi dự án chỉ có một `pending-config.json` đang chờ. Sau khi một đề xuất được xử lý, công cụ `propose` mới có thể tạo đề xuất tiếp theo.

## Dành cho ChatGPT qua Remote Desktop Commander

Đọc cấu hình đã lưu:

```powershell
python scripts/ssr_story_bridge.py inspect --project "D:\du-an\ten-truyen"
```

Đọc lịch sử, bao gồm phản hồi yêu cầu sửa:

```powershell
python scripts/ssr_story_bridge.py history --project "D:\du-an\ten-truyen"
```

Gửi đề xuất mới:

```powershell
python scripts/ssr_story_bridge.py propose --project "D:\du-an\ten-truyen" --input "D:\de-xuat.json"
```

Chi tiết định dạng JSON đầu vào vẫn theo `docs/SSR_STORY_BRIDGE_V0.md`.

## Kiểm thử

- `python scripts/test_story_bridge.py`: kiểm tra đề xuất, lịch sử, chống ghi đè và SQLite không đổi.
- `pnpm exec vitest run electron/services/__tests__/story-bridge-review-service.test.ts`: kiểm tra bản đã lưu trong SQLite, từ chối, yêu cầu sửa, xử lý trùng lặp và phân quyền dữ liệu dự án.
- `pnpm run typecheck`, `pnpm run lint`, `pnpm run check:i18n`, `pnpm run build`.

## Những gì còn cần làm

- Chưa có hệ thống đa tác giả hoặc đồng bộ trên cloud.
- Chưa có bài thử click tự động toàn bộ màn hình Windows; người dùng cần kiểm tra v1 trên máy thật.
- Đây vẫn là chế độ **Remote Desktop Commander**, không phải MCP Server trực tiếp trong ChatGPT.
- Chưa tích hợp cầu nối với hồ sơ nhân vật, sơ đồ cốt truyện và bản nháp chương. Những thao tác đó cần cơ chế review riêng cho từng loại dữ liệu.
