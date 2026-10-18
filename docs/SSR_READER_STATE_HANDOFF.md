# SSR Reader — Bàn giao nguồn và kiểm thử cục bộ (snapshot 18/10/2026)

**QUAN TRỌNG:** GitHub nhánh này lưu roadmap, KHÔNG bao gồm toàn bộ source Stage 3 đã phát triển trên laptop. Khi chat mới, xin phép truy cập laptop nghia và kiểm tra read-only trước; không tự nhận GitHub phản ánh đúng bản EXE hiện tại.

## Nơi lưu Reader ở laptop nghia

Gốc ứng dụng thử: D:\1-tool\8-SSR-Reader

| Thành phần | Đường dẫn tương đối từ gốc |
| --- | --- |
| Reader Stage 2.2 | Stage2_2-LibraryGrid-20261018\source |
| Reader Stage 2.2 portable | Stage2_2-LibraryGrid-20261018\Portable-Stage2_2-Preview\SSR Reader.exe |
| Reader + Author Studio Stage 3 nguồn | Stage3-IllustratedEncyclopedia-20261018\source |
| Reader Stage 3 portable | Stage3-IllustratedEncyclopedia-20261018\Portable-Stage3-Preview\SSR Reader.exe |
| Author Studio Stage 3 portable | Stage3-IllustratedEncyclopedia-20261018\Portable-Stage3-Author-Studio\SSR Author Studio.exe |
| Tài liệu chi tiết local | Stage3-IllustratedEncyclopedia-20261018\STAGE3_README.md |
| Báo cáo test | Stage3-IllustratedEncyclopedia-20261018\artifacts\STAGE3_VERIFICATION.json |

Dữ liệu thử nằm riêng tại Stage3-IllustratedEncyclopedia-20261018\pilot-userdata\reader-library, KHÔNG được thay thế thư viện Reader hiện đang dùng. Nguồn nền SSR-Reader-Source có working tree sửa đổi chưa commit; không tự git reset, checkout hay copy đè. Repo Writer trên laptop cũng là thư mục khác.

## Đã báo cáo nghiệm thu kỹ thuật ở Stage 3 local

- 37/37 unit tests PASS (theo Stage3 local README).
- Electron E2E: Reader chống spoiler, nhập/đọc, ghi chú/tô màu, thư viện giả lập 100 cuốn, 200 chương theo quyển; Author Studio tạo nháp/ảnh và ký dữ liệu Ed25519.
- ZIP backup/restore bản sao 200 chương khớp 202/202 tệp SHA-256.
- Pilot Reader có 200 chương bản sao và tác phẩm giả lập 90 chương cho từ điển. **Không gắn dữ liệu “Lâm Phong”, “Thiên Vân Thành” vào tác phẩm thật**, vì đó chỉ là tên mô phỏng.
- Reader Stage 3 đã bỏ các lệnh IPC sửa metadata/cover chính thức. Một gói từ điển được ký đúng mới được đọc; ảnh/mô tả chỉ hiện đến mốc hoàn thành **liên tiếp từ chương 1**. Các mục về sau không được gửi tên/ảnh thật tới UI.

**Giới hạn Stage 3:** tác giả pilot vẫn chọn khóa .pem thủ công; chưa có login đa người dùng hay quyền sở hữu trên server; metadata/cover chưa được ký đầy đủ, TTS/sync chưa sản phẩm hóa, kết nối tạo ảnh ChatGPT là sao chép prompt và người dùng tự duyệt/tải ảnh. Đây là **pilot** chứ không phải bản public an toàn.

## Phương pháp bắt đầu lại với một chat mới

1. Đọc SSR_READER_START_HERE.md và docs/SSR_ACCOUNT_AUTHOR_READER_DECISIONS.md.
2. Xác minh người dùng cho phép đúng máy nghia; dùng Remote Desktop Commander chỉ với quyền đã cho, không truy cập VCC-PHUONG23.
3. Trên laptop kiểm tra file Stage 3, git status, README, báo cáo test, snapshot và ứng dụng thực tế.
4. Tạo bản sao nguồn và dùng dữ liệu giả lập cho tính năng tiếp theo. Không dùng truyện gốc/test-1.
5. Chạy lại test và báo bằng chứng; không tự tuyên bố hoàn thành chỉ dựa vào nhật ký ngày 18/10.
6. Không tự đưa mã nguồn Stage 3 lên GitHub; muốn lưu source cần lọc private key, DB, ZIP, chapter TXT, EXE và artifacts, kiểm tra licensing rồi chọn repo/nhánh riêng với tác giả.

## Không bao giờ đẩy lên repository công khai

Private author key, thư mục author-private-demo, bất kỳ file .pem, chapter TXT cá nhân, truyện thật, SQLite/.vela, backup, ảnh cá nhân, hồ sơ Reader đang dùng, API key/token, hoặc thông tin định danh không cần thiết.
