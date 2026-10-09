# SSR Story Bridge v2 — Cấu trúc truyện và vòng đời nhân vật

## Các phần đã triển khai

- **Duyệt đề xuất nhân vật:** xác nhận đã lưu khi `character_roster_meta.revision` tăng và *tất cả trường* trong hồ sơ đề xuất khớp dữ liệu SQLite đang lưu. Có Từ chối, Yêu cầu sửa và Lịch sử; nội dung cùng phản hồi được lưu trong `.vela/story-bridge/history/characters/<uuid>.json`. Không tự sửa nhân vật hay xóa hồ sơ hiện có.
- **Cấu trúc truyện:** `inspect-architecture` đọc `premise`, `worldbuilding`, `synopsis` từ SQLite read-only. `propose-architecture` lưu bản chờ tại `.vela/story-bridge/pending-architecture.json` (tạo mới độc quyền, không ghi DB).
- **Duyệt cấu trúc:** màn hình Cấu trúc truyện có nút Đề xuất từ ChatGPT để xem phần hiện tại/đề xuất mới, Chấp nhận và lưu, Từ chối, Yêu cầu sửa, Lịch sử.
- Khi **Chấp nhận và lưu**, main process kiểm tra quyền phiên dự án và dùng giao dịch SQLite với điều kiện `WHERE premise = ? AND worldbuilding = ? AND synopsis = ?` để ngăn ghi đè nếu cấu trúc bị thay đổi sau khi ChatGPT đọc. Các tab kiến trúc còn thay đổi chưa lưu sẽ chặn thao tác ở giao diện.
- Sơ đồ nhân vật `characters.md` là bản chiếu chỉ đọc của roster chính thức: **không nhận sửa trực tiếp** qua Bridge để tránh tạo nguồn dữ kiện song song.
- Archive độc quyền, có `fsync`, chống lưu trùng ID và khôi phục sau trường hợp crash giữa DB commit và ghi receipt. Với đề xuất đã xử lý, dữ liệu lưu trong `.vela/story-bridge/history/architecture/<uuid>.json`.

## Chạy CLI

```powershell
cd "D:\1-tool\7-SSR-viet-truyen"
python scripts/ssr_story_bridge.py inspect-architecture --project "D:\SSR-truyen test\test-1"
python scripts/ssr_story_bridge.py propose-architecture --project "D:\SSR-truyen test\test-1" --input "D:\de-xuat.json"
```

JSON đầu vào có `projectId`, `changes` (chỉ `premise`, `worldbuilding`, `synopsis`), `note`. Không gửi `charactersArch` hoặc thông số 500 chương/2.500 từ bằng con đường này.

Đọc lại lịch sử nhân vật hoặc cấu trúc qua giao diện; các tệp lịch sử được lưu cùng dự án trên máy, không tự đồng bộ GitHub.

## Trạng thái dữ liệu thử

- Dự án `test-1` chỉ có ở laptop `nghia`, đường dẫn `D:\SSR-truyen test\test-1`; dữ liệu riêng **không có trên GitHub**.
- Đã tạo **đề xuất mới cho `premise` và `worldbuilding`** của Thiên Mạch Vô Danh, còn chờ người dùng duyệt.
- `synopsis` chưa được điền vì luồng hiện tại của ứng dụng có cơ chế phân tích dàn ý theo chương; không được đánh dấu đã hoàn thành 500 chương chỉ bằng bản tóm tắt năm quyển.
- Những đề xuất nhân vật từ phiên trước có thể còn là pending dù đã lưu vào roster. Chức năng v2 cho phép người dùng mở đề xuất cũ, chọn **Xác nhận đã lưu**; main process sẽ kiểm tra lại toàn bộ trường và đưa vào lịch sử nếu khớp.

## Hạn chế

- Chưa có thử nghiệm click thực tế trong giao diện Electron cho màn hình v2. Cần mở bản phát triển và xác nhận luồng duyệt không va chạm tab đã chỉnh sửa.
- Chưa có trợ lý viết 500 chương tự động hay MCP Server trực tiếp. V2 vẫn dùng ChatGPT cuộc trò chuyện + Remote Desktop Commander.
- Nên chạy toàn bộ regression suite trước khi merge. Giữ PR ở trạng thái Draft.
