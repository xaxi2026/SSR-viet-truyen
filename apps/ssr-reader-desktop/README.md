# SSR Reader — Ứng dụng đọc truyện riêng cho Windows (Pilot 0.1.0)

**Trạng thái:** đã có bản Windows **portable chạy riêng**, chưa có trình cài đặt/Release chính thức. Tính năng điện thoại **để sau khi tiếp tục sản xuất truyện**.

## Hai sản phẩm khác nhau

- **SSR-viet-truyen Writer:** tạo, duyệt, sửa chương, quản lý hồ sơ cốt truyện/dàn ý/bí mật/tình tiết gợi mở và dữ liệu dự án riêng.
- **SSR Reader:** cửa sổ độc lập chỉ để **đọc các tệp TXT do người dùng chủ động chọn**. Không có `project-store`, Electron IPC của Writer, SQLite/.vela Writer, AI/API key hay quyền tự đọc thư mục truyện của Writer.
- Bản Pilot hiện chỉ cho **đọc cá nhân trên Windows**. **Không** tuyên bố TXT chọn thủ công đã được hệ thống xác nhận `finalized/public` hay an toàn để chia sẻ. Khi muốn phân phối cho độc giả cần thêm **Public Release Exporter / SSRBook v1** có tác giả duyệt.

## Cách mở

Trên máy công ty đã thử:
- Lối tắt dự kiến trên Desktop: **SSR Reader - Doc truyen (Pilot)**.
- EXE portable: `D:\SSR-NGHIA\SSR-Reader-Windows-Pilot\SSR Reader.exe`.
- Có thể chạy EXE này **không cần mở SSR Writer, không cần Node/npm**, miễn giữ nguyên toàn bộ thư mục portable 344 MB (gồm runtime Electron).
- Thư viện riêng của Reader: %APPDATA%\SSR Reader\reader-library. Không sao chép hay liên kết đến dự án `.vela`.

## Cách đọc

1. Nhập **Tên sách** tùy ý.
2. Bấm **+ Nhập chương TXT**, chọn các tệp TXT chỉ chứa chương muốn đọc (có thể chọn nhiều tệp). Có thể dùng các tệp bản chương **đã chốt** mà bạn xác minh; tuyệt đối không chọn tài liệu dàn ý hay Hồ sơ cốt truyện để chia sẻ.
3. Reader sẽ sắp chương theo số trong tên tệp (`Chương 1`, `Chapter 1`, `第1章` hay `001 - ...`). Chương không nhận được số sẽ đánh số theo thứ tự bạn chọn; đặt tên tệp đúng số để tránh nhầm.
4. Đọc, tìm văn bản trong chương, dùng **Trước / Sau**, điều chỉnh font, chọn nền sáng/vàng/tối, đánh dấu vị trí và tiếp tục khi mở lại.
5. **Xóa sách** chỉ xóa bản sao đã nhập trong Reader. File TXT gốc vẫn nguyên vẹn.

Giới hạn bảo vệ: 1–1.500 tệp TXT mỗi lần nhập, tối đa 4 MB/tệp, 160 MB/lượt, 500 đầu sách. Chỉ chấp nhận UTF-8; dữ liệu hiển thị bằng `textContent`, không thực thi HTML/JS. Reader không kết nối Internet.

## Mã nguồn / kiểm thử

Thư mục app này là sản phẩm **độc lập** trong nhánh PR Reader; không import code Writer. Có thể chuyển sang repo Reader riêng ở giai đoạn sau mà không cần mang theo dự án tác giả.

- `reader-core.cjs`: số chương, xác minh TXT, danh sách và tiến độ đọc, giới hạn.
- `main.cjs` và `preload.cjs`: Electron cô lập, IPC hẹp, hộp thoại OS cho người dùng chọn TXT.
- `reader.js`, `index.html`, `styles.css`: giao diện đọc cục bộ, không gọi API.
- `tests/reader-core.test.cjs`: kiểm thử dữ liệu, bảo vệ IPC và TXT.
- `tests/reader-e2e.cjs`: Chromium/Electron E2E trên **profile thử tạm trong %TEMP%**, nhập 3 chương giả lập, điều hướng 1→2, tìm kiếm, dấu trang và lưu giao diện qua khởi động lại. Cần Playwright khi chạy thử tự động.

Thử nghiệm bằng runtime Electron đã có trên máy:
```powershell
$env:SSR_READER_ELECTRON_BIN = 'D:\SSR-NGHIA\SSR-Reader-Windows-Pilot\SSR Reader.exe'
$env:NODE_PATH = 'D:\SSR-NGHIA\SSR-viet-truyen-story-bible-20261013\node_modules'
node tests/reader-core.test.cjs
node tests/reader-e2e.cjs
```

**Không thay Node/npm/Electron trong SSR Writer để chạy Reader.** Khi cần phát hành installer Windows, setup signer và dùng electron-builder sau các bài QA/kiểm thử trên Windows; không nhầm portable thử với release chính thức.

## Phát triển tiếp sau nghiệm thu

1. Nếu tác giả nghiệm thu bản Windows Pilot: **quay lại sáng tác truyện**, không chờ PWA/Android.
2. Khi cần gửi truyện cho người đọc khác: bổ sung **Xuất bản cho độc giả** bên Writer với chỉ các chương finalized do tác giả chủ động chọn, gói SSRBook v1 strict allowlist/hash, bảo đảm không có bí mật/dàn ý/bản nháp.
3. Về sau, khi tác giả yêu cầu: chuyển SSR Reader thành web/PWA, Android APK, iPhone PWA/native.

Tài liệu quyết định lâu dài: `SSR_READER_START_HERE.md`, `docs/SSR_READER_APP_ARCHITECTURE.md`, `docs/SSR_READER_APP_DEVELOPMENT_GUIDE.md` trong PR tài liệu #21, và Issue #20. Chi tiết triển khai tại PR Windows Reader riêng.

**Không merge GitHub, không đụng `test-1`, không sửa Kaspersky hay bản Writer đang chạy.**
