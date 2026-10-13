# Hướng dẫn cho ChatGPT và lập trình viên — SSR Reader (ứng dụng đọc truyện riêng)

> **BẮT ĐẦU Ở ĐÂY khi phát triển ứng dụng đọc truyện cho độc giả.** Đây là chỉ dẫn triển khai, không phải bằng chứng app/PWA/APK đã ra mắt.  
> Nguồn sự thật: [Issue #20](https://github.com/xaxi2026/SSR-viet-truyen/issues/20) và [Đặc tả kiến trúc](SSR_READER_APP_ARCHITECTURE.md).  
> Mã Writer hiện lưu ở [xaxi2026/SSR-viet-truyen](https://github.com/xaxi2026/SSR-viet-truyen). Nhánh PR #13, #18, #19 là nguồn tham khảo **chưa merge**; kiểm tra commit thật khi làm.

## A. Mục tiêu một câu

**SSR Writer dùng để SÁNG TÁC và quản lý bí mật; SSR Reader dùng để ĐỌC các chương đã được tác giả chủ động công bố.** Không có chế độ “Reader account” bên trong Writer, không khóa màn hình làm biện pháp bảo mật. App đọc dùng tốt trên điện thoại, offline, không biết đường dẫn/SQLite của tác giả.

## B. Công việc cần thực hiện từ đầu — không bỏ giai đoạn

### M0 — Khởi động đúng repo và xác thực thông tin

1. Đọc `SSR_READER_START_HERE.md`, tài liệu này, `docs/SSR_READER_APP_ARCHITECTURE.md` và Issue #20 trên **nhánh tài liệu Reader**. Sau đó đọc `AGENTS.md`, `CHATGPT_START_HERE.md` và `docs/READER_COMPLETION_ACCEPTANCE_2026-10-13.md` **trên nhánh PR #13 hoặc #19**: các tệp này chưa có trong `master` tại ngày viết.
2. Đọc thực tế `src/components/editor/ManuscriptReader.tsx`, `reader-library.ts`, `reader-navigation.ts`, `src/components/dialogs/ExportDialog.tsx`, `src/services/export-service.ts`, `electron/services/manuscript-publisher.ts`, finalization repository/service; lấy **commit SHA**, không suy đoán theo tài liệu cũ.
3. Xác minh repo/branch/PR cụ thể và các thay đổi local chưa push trước khi lấy; GitHub source không chứa dữ liệu truyện.
4. Hỏi/ghi quyết định về phân phối khi cần: PWA trước hay Android APK trước, sách chỉ để cá nhân hay công khai, nơi lưu file release. **Không chặn M0/M1 chỉ vì chưa chọn App Store.**
5. Mỗi tính năng thực hiện trên issue-linked branch riêng; không tự merge. Hãy tạo repo Reader độc lập **khi có quyền và xác nhận**, đề xuất slug `xaxi2026/SSR-viet-truyen-reader`. Nếu chưa có quyền tạo repo, chỉ làm phần an toàn Writer và báo trạng thái; **không tuyên bố repo đã tạo**.

### M1 — Tạo Writer Public Release Exporter an toàn

**Tạo luồng mới, không dùng gói Backup/Restore.** Đầu vào là một phiên dự án hợp lệ và **tập finalized chapter do tác giả chọn**. Tạo snapshot bất biến/khóa nội dung đã duyệt, check session lease, đối chiếu hash. Nếu chương vừa sửa/đã bị hủy chốt → không xuất.

Gợi ý bố trí code (chưa phải file hiện tồn tại):

```text
src/shared/public-book-contract.ts
src/services/publication-client.ts
src/components/dialogs/PublicReaderReleaseDialog.tsx
electron/services/public-book-exporter.ts
electron/controllers/public-book-controller.ts
electron/services/__tests__/public-book-exporter.test.ts
```

Yêu cầu bắt buộc:
- Tạo `PublicBookManifestV1` **riêng hoàn toàn** và validate strict. Cho phép đúng: schemaVersion, bookId public, releaseVersion, title, authorDisplayName, description, writingLanguage, cover được duyệt, chương {public id, number, title, path, sha256}. Không serialize record thừa.
- Nội dung chương chỉ lấy **snapshot finalized hiện hành** từ nguồn uy tín trong `finalization-repository` và xác minh bản công bố; không lấy file ngẫu nhiên dựa vào path do renderer truyền.
- Mặc định **không có chương nào được đánh dấu công bố**. UI hiển thị chính xác chương nào, nội dung nào sẽ ra ngoài; phải bấm xác nhận trước khi tạo file. Nếu dữ liệu thay đổi ở bất kỳ bước nào, phải xem lại.
- Gói file chỉ chứa allowlist và text của chương. Cover phải loại metadata nhạy cảm, dùng filename cố định, chặn URL ngoài và URI nguy hiểm.
- Tài liệu công bố không được có: `Story Bible`, bí mật tác giả, `narrative-thread` kế hoạch, dàn ý, blueprint, draft/review/revision, API key/model config, history, raw SQLite/.vela, project path, author note, thư mục cache, logs.
- **Không được lấy cách “export + includeOutline=false” làm bảo đảm ranh giới**. Đây là hành động mới có hợp đồng khác, thêm leak/canary tests riêng.
- Có quy tắc manifest version và kiểm tra SHA-256; lưu biên nhận riêng để tác giả có thể tạo bản phát hành mới mà không tráo nội dung ngầm.
- Có test lùi: thao tác Writer cũ và `test-1` không đổi; test trên project tạo mới hoàn toàn, KHÔNG nhập bản thật.

Lối nhanh trước khi có Reader app: **xuất EPUB an toàn từ cùng snapshot đã duyệt**, để độc giả dùng app đọc sách sẵn có. Không xem EPUB là thay thế mục tiêu phát triển SSR Reader riêng.

### M2 — Ứng dụng đọc Web/PWA **độc lập**

Repo riêng chỉ giữ mã reader, asset công cộng và fixture giả. Gợi ý sơ đồ module:

```text
SSR-viet-truyen-reader/
  src/
    contracts/public-book-v1.ts
    import/validate-bundle.ts
    storage/reader-library.ts
    components/BookShelf.tsx
    components/ReadingView.tsx
    components/ChapterList.tsx
    preferences/reader-settings.ts
  public/manifest.webmanifest
  tests/
    security/
    reader-e2e/
  package.json
  LICENSE
  README.md
```

Lựa chọn kỹ thuật đề xuất **React + Vite + TypeScript**, PWA manifest + service worker, IndexedDB cho sách đã import. `id` chapter public không được lấy từ primary-key SQLite, position/bookmarks không dùng máy/project path của tác giả. Có thể trích các hàm UI thuần của Reader hiện có nếu rà dependency và GPL-3.0.

Nguyên tắc nhập file:
- Chỉ chấp nhận `.ssrbook` với manifest **strict** và định dạng chapter đã hỗ trợ.
- Kiểm tra tệp/nén, kích cỡ/ratio, tên file, CRC/hash, trùng lặp, đường dẫn, kiểu nội dung, giới hạn số chapter; fail-closed.
- Text của sách là dữ liệu, không được `eval`, HTML thô, JavaScript, `javascript:` hoặc truy vấn network từ nội dung nhập.
- Không yêu cầu API key, tài khoản ChatGPT hay SSR Writer. Mặc định không thu thập telemetry hoặc đăng thông tin sách lên cloud.
- Tủ sách phải hiện offline sau khi đóng/mở; không đòi máy tác giả bật. Lưu tiến độ và bookmark theo public book/chapter.
- Hỗ trợ Unicode tiếng Việt, cuộn nhiều chương, font/line-height/dark-mode, search trong chương, vào lại chương đang đọc, đồng bộ trạng thái UI và quy tắc import lại release.
- Làm việc với sách **500 chương giả lập** (lazy read theo chương, không load tất cả text lên DOM và không lập full-text index bắt buộc khi mở).
- Mobile e2e trong Chromium Android giả lập và manual Safari trên iPhone khi có thiết bị.

### M3 — Gói Android

Sau khi PWA ổn định mới đánh giá Capacitor; có thể dùng cùng UI. Tạo target Android riêng, test file picker, lưu offline, back navigation, viewport/font, dark mode, nâng cấp và xóa dữ liệu. Tạo APK debug **không phải** bản Play Store. Chỉ chia sẻ APK/AAB đã build thật, gắn commit SHA, checksum, version và nguồn phát hành.

Không cần máy chủ để đọc file đã import. Để độc giả tự tìm và tải sách mới qua Internet, cần thêm kênh phân phối và quyền công bố riêng ở M5.

### M4 — iPhone

Test iOS Safari/Add to Home Screen/PWA trước. Chỉ bắt đầu native iOS khi có Mac/CI ký và quy trình phân phối; khác biệt iOS/Android trong file picker, quota offline, cài đặt cần được kiểm thử, không suy đoán.

## C. Test và tiêu chí nghiệm thu có thể tự động hoá

| Nhóm | Bài kiểm tra |
| --- | --- |
| Privacy | Seed **synthetic secret markers** trong Story Bible/dàn ý/draft/nội dung chưa public; xuất release phải **không có marker** ở bất kỳ file nào |
| Public gating | Chapter finalized nhưng chưa được tác giả chọn **không xuất**; không finalized bị chặn; thay đổi snapshot sau preview bị chặn |
| Isolation | Reader build/import không yêu cầu writer code/SQLite/Electron/API keys, network port writer hoặc thư mục .vela |
| Contract | Gói đúng schema/hash nhập được; bản sửa hash, URL nguy hiểm, path traversal, thư mục ẩn, duplicate chapter/file, 2GB bomb giả bị từ chối |
| Functional | Import một sách → TOC → mở chương → previous/next → tìm → bookmark → theme → đóng/mở → tiếp tục, offline |
| Scale | 1, 100, 500 chương giả; tốc độ/chuyển chương hợp lý, không OOM |
| Cross device | Chromium desktop + Android thật/browser, iOS Safari/PWA smoke |
| Regression | `pnpm run typecheck`, `pnpm run lint`, `pnpm run check:i18n`, tests chuyên biệt, Vite build; Windows packaged smoke trước release |
| Author approval | Không auto-finalize, không auto-publish; ghi receipt gắn đúng hash đã tác giả xác nhận |

## D. Quy tắc báo cáo trung thực

Trong mỗi phiên ChatGPT cần nói rõ:
- **M0 thiết kế**, **M1 Writer exporter**, **M2 Reader PWA**, **M3 Android**, **M4 iOS** đã ở mức nào: kế hoạch, code, tests, app chạy, hay đã phát hành.
- Git branch + commit + PR/issue; những bước chưa kiểm thử, thiết bị nào đã kiểm thử.
- App chạy trong môi trường dev/preview **không đồng nghĩa** đã có URL công khai hay APK để tải.
- Không bao giờ mang nội dung bản thảo thật hoặc dữ kiện bí mật lên GitHub/đưa vào test fixture.
- Nếu có yêu cầu “cập nhật app điện thoại”, phải xác nhận platform, nguồn cài và phiên bản trước khi hành động. Không tự đóng gói hoặc phát hành truyện thật.

## E. Mẫu tin nhắn để mở chat mới

> Tiếp tục dự án **SSR Reader — ứng dụng đọc truyện riêng cho điện thoại**, Issue #20 của `xaxi2026/SSR-viet-truyen`. Hãy đọc `SSR_READER_START_HERE.md`, `docs/SSR_READER_APP_ARCHITECTURE.md` và `docs/SSR_READER_APP_DEVELOPMENT_GUIDE.md` trên nhánh tài liệu Reader hiện hành, rồi kiểm tra `AGENTS.md` và các PR #13/#18/#19 trên đúng nhánh. Mục tiêu: độc giả chỉ đọc các chương tôi chủ động công bố, không thấy Hồ sơ cốt truyện, dàn ý, manh mối hay bản nháp; ưu tiên PWA và Android. Báo cáo giai đoạn thực tế, lập kế hoạch từng PR và triển khai trên nhánh riêng. Không động `test-1`, truyện thật, dữ liệu máy công ty nếu tôi chưa cho phép, không tự xuất bản sách và không tự merge.

## F. Tài liệu bổ sung

- [Đặc tả ứng dụng SSR Reader](SSR_READER_APP_ARCHITECTURE.md)
- [Bằng chứng màn hình Reader Writer hiện có](READER_COMPLETION_ACCEPTANCE_2026-10-13.md)
- [Quy tắc Writer trên nhánh PR #19](https://github.com/xaxi2026/SSR-viet-truyen/blob/feat/linked-foreshadowing-tracks-20261013/AGENTS.md) — không có trên master ngày viết
- [Issue công việc](https://github.com/xaxi2026/SSR-viet-truyen/issues/20)
