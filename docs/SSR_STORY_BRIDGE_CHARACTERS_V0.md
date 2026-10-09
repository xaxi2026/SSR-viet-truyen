# SSR Story Bridge — Đề xuất nhân vật v0

## Mục đích

Đề xuất hồ sơ nhân vật theo cách tương tự cầu nối cấu hình, nhưng **không tự động ghi vào SQLite** và **không ghi đè nhân vật đã có**.

## Quy trình an toàn

1. ChatGPT đọc cấu hình chính thức bằng `inspect` và kho nhân vật bằng `inspect-characters`.
2. Gửi tối đa 12 nhân vật trong một tệp JSON. Mỗi người có đầy đủ 12 trường: `name`, `role`, `gender`, `age`, `appearance`, `personality`, `background`, `abilities`, `motivation`, `relationships`, `arc`, `notes`. `role`: protagonist/supporting/antagonist/minor.
3. `relationships` phải để chuỗi rỗng ở phiên bản đầu; thông tin quan hệ có thể mô tả tạm trong `notes`. Không ghi trạng thái chương hay nguồn dữ kiện chưa được kiểm chứng.
4. CLI lưu tệp `.vela/story-bridge/pending-characters.json` chỉ khi tên nhân vật không trùng nhân vật chính thức và không có đề xuất đang chờ.
5. Mở SSR-viet truyen → **Nhân vật** → **Đề xuất từ ChatGPT** → **Đọc đề xuất nhân vật**.
6. Xem tên, động cơ, xuất thân và diễn biến của từng nhân vật. Nếu đồng ý, chọn **Thêm vào danh sách bản nháp**. Hệ thống sẽ kiểm tra chính xác `projectId`, `rosterRevision`, tên trùng, phiên dự án và các thao tác đang bận.
7. Sau khi kiểm tra hồ sơ trong trình soạn thảo nhân vật, nhấn **Lưu** để kích hoạt quy trình commit danh sách nhân vật đang có, có kiểm soát revision và cập nhật các bản chiếu quan hệ.

Không chỉnh sửa SQLite khi đọc hoặc gửi đề xuất. Không xoá hồ sơ cũ, không sửa hồ sơ cũ, không nhập `currentState`/provenance từ AI.

## Lệnh mẫu

```powershell
python scripts/ssr_story_bridge.py inspect-characters --project "D:\SSR-truyen test\test-1"
python scripts/ssr_story_bridge.py propose-characters --project "D:\SSR-truyen test\test-1" --input "D:\de-xuat-nhan-vat.json"
```

## Trạng thái phát triển

Đây là bước thử đầu tiên cho cầu nối nhân vật, chưa phải luồng v1 với đầy đủ Chấp nhận/Từ chối/Lịch sử cho đề xuất nhân vật. Tệp pending nhân vật **chưa được tự động lưu trữ hay thu hồi sau khi Save**. Không thể gửi một đề xuất nhân vật thứ hai vào cùng dự án cho tới khi có vòng đời xử lý tệp được bổ sung trong phiên bản sau. Không được sửa/xóa trực tiếp tệp trong khi ứng dụng đang xử lý đề xuất.

Cần thử nghiệm giao diện đầu-cuối trên Windows trước khi đưa vào nhánh chính. Chưa có server MCP trực tiếp.
