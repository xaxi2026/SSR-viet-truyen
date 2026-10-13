# Việt hóa Cốt truyện và tuyến tình tiết — GitHub handoff (13/10/2026)

## Phạm vi PR này

- Nền mã nguồn: `feat/chatgpt-workspace-foundations-20261011` (head của draft PR #13; commit `e5f8beb7fcfa880d95e23fd4b700f6ce4f57441d`).
- Thêm `src/i18n/vi-narrative-threads.ts`: nhãn, cảnh báo và thông báo của **Plot Tree / Narrative Threads**.
- Đăng ký từ điển trong `src/i18n/core.ts` **chỉ cho `vi-VN`**.
- Thêm kiểm tra cho các lời gọi `text(zh, en)` dạng hai chuỗi nguyên văn tại `NarrativeThreadEditor.tsx` và `PlotTreeView.tsx`; kiểm tra giữ nguyên `en-US`/`zh-CN`.
- Đối chiếu tĩnh bằng GitHub source: 73 lượt gọi trong `NarrativeThreadEditor.tsx` và 18 lượt trong `PlotTreeView.tsx`, không còn chuỗi tĩnh thiếu bản dịch trong hai màn hình này.

## Giới hạn phải ghi rõ

**KHÔNG phải Việt hóa 100% SSR.** Các nhãn/đoạn động, các màn hình khác, giao diện `Story Bible`, văn bản JSX trực tiếp và smoke test Windows còn cần nghiệm thu. Trên GitHub hiện **chưa có** những thay đổi thử nghiệm trên máy công ty:

- `feat/story-bible-20261013` **cục bộ**: triển khai Sổ tay/Hồ sơ cốt truyện, SQLite, IPC, giao diện Pilot.
- Các file `vi-story-bible.ts`, `vi-workflow-extra.ts`, `vi-workflow-reviewed*.ts`, `vi-ui-patterns*.ts` và kiểm thử cục bộ. **Không được suy ra các file đó đã push**.
- Vẫn còn cảnh báo Kaspersky với Remote Desktop Commander; **không sử dụng ngoại lệ antivirus hoặc can thiệp dữ liệu truyện để chuyển mã nguồn**.

Khi có phương án chuyển những commit cục bộ một cách an toàn (ví dụ GitHub Desktop từ máy đã được xác minh), so sánh khác biệt giữa nhánh Pilot cục bộ và nhánh GitHub này, **giải quyết xung đột tại `core.ts`**, giữ cả các bản dịch không trùng, rồi mới kiểm thử và đề xuất merge. Không xóa công việc đã làm chỉ để đồng nhất nhánh.

## Tiêu chí nghiệm thu

1. `pnpm run typecheck`, `pnpm run check:i18n`, `pnpm run lint`, `pnpm test`, `pnpm run build`.
2. Manual UI: chọn `vi-VN`; kiểm tra tab sơ đồ, danh sách manh mối, tạo/sửa/xóa với một **dự án test riêng**, nội dung tiếng Việt và phản hồi lỗi.
3. Mở lại với `en-US` và `zh-CN` để kiểm tra không có hồi quy.
4. Mọi schema, bản thảo, ngôn ngữ sáng tác và dữ liệu truyện **không đổi**; chưa chạm `test-1`.
5. Windows installer/GUI smoke trước khi chuyển vào bản cài mặc định. **Không tự merge**.
