# SSR: duyệt dàn ý → blueprint thật → bản nháp chương 1

## Phạm vi

Bước thử nghiệm an toàn cho tác phẩm tiếng Việt có **500 dàn ý đã được tác giả duyệt**. Lấy các bản ghi 1–10 từ biên nhận Story Bridge bất biến để tạo blueprint tương ứng trong **BlueprintRepository**, dùng nội dung một chương đã soạn riêng để tạo **DraftRepository** và **ContentRepository** cho chương 1. Tất cả bản nháp luôn giữ `status=draft`, không chạy finalization, postprocess hoặc cập nhật `project_core.synopsis`. Không tự động gọi AI provider.

Dữ liệu riêng (văn xuôi, tên nhân vật, ID project, đường dẫn cụ thể và DB) **không đưa lên GitHub**; chúng nằm trong thư mục truyện cục bộ và tệp nháp ngoài repository. Source chỉ giữ logic tích hợp và quy tắc xác minh.

## Lệnh trên Windows

Dùng lệnh `--dry-run` trước để xác nhận trạng thái; đặt `<...>` bằng giá trị thật của máy đang làm việc.

```powershell
python -X utf8 scripts\ssr_chapter_pilot_runner.py --dry-run --project '<PROJECT_PATH>' --draft '<CHAPTER_1_UTF8_MD>' --project-id '<STORY_BRIDGE_PROJECT_ID>'
python -X utf8 scripts\ssr_chapter_pilot_runner.py --project '<PROJECT_PATH>' --draft '<CHAPTER_1_UTF8_MD>' --project-id '<STORY_BRIDGE_PROJECT_ID>'
```

Runner:
1. Dùng `ssr_outline_bridge.inspect` đọc nguồn, chặn khi `coveredTo!=500`, source drift, đề xuất đang chờ hay project ID sai.
2. Kiểm tra tệp văn xuôi và độ dài khoảng 2.500 đơn vị từ; backup DB bằng **SQLite backup API** trước thay đổi.
3. Bundle `scripts/ssr_approved_chapter_import.ts` bằng esbuild, dùng đúng **Electron native Node ABI** cho `better-sqlite3`. Shim chỉ ngăn truy cập Electron `userData`, không đọc hay sao chép secret nào.
4. Importer gọi đúng `BlueprintRepository.upsert` và `DraftRepository.create` trong một transaction, không tự viết SQL cho nội dung truyện. Nó đối chiếu lịch sử accepted từ 1 đến 500, schema canon, cấu hình tiếng Việt, danh sách nhân vật chính thức và draft hiện có. Tất cả quan hệ nhân vật lấy từ DB authoritative, không gán tên nhân vật cố định trong mã nguồn.
5. Chạy lại không tạo bản nháp trùng. Nếu blueprint/draft đã tồn tại nhưng khác nội dung, **chặn**, không ghi đè bản tác giả đã sửa. Sau chạy kiểm tra read-only: 10 blueprint, 1 draft, nội dung trùng, không có finalization và SQLite integrity ok.

## Xem bản nháp

Mở lại dự án trong SSR để tải lại bảng blueprint và draft. Vào khu vực chương, tìm chương 1 và bản nháp v1 để đọc, sửa hoặc yêu cầu viết lại. Phần mềm chỉ coi là nội dung chính thức sau khi **tác giả trực tiếp duyệt** theo quy trình sẵn có.

**Giới hạn:** thí điểm chỉ nhập blueprint 1–10 và bản nháp chương 1. Chưa nhập blueprint 11–500, chưa làm chức năng tự động sáng tác 500 chương hay tự sinh nội dung nền. GUI E2E chưa chứng minh đạt. Không đồng bộ sang máy khác nếu người dùng chưa yêu cầu; không tự merge PR.
