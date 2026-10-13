# SSR Reader — Thiết kế tách ứng dụng đọc truyện khỏi SSR-viet-truyen


> **ƯU TIÊN CẬP NHẬT 13/10/2026 — QUYẾT ĐỊNH CỦA TÁC GIẢ:** triển khai **ứng dụng SSR Reader riêng trên Windows trước**, nghiệm thu rồi **quay lại sản xuất truyện**. **PWA/Android/iPhone chuyển sang giai đoạn sau**. Các đoạn nhắc “PWA trước” bên dưới chỉ là phương án nghiên cứu cũ, **không còn là thứ tự triển khai**. Giai đoạn Windows cho phép **nhập TXT được tác giả chọn thủ công để đọc riêng trên máy**, không được quảng bá là xuất bản/publication. Khi cần chia sẻ cho độc giả mới phát triển Safe Release Exporter theo hợp đồng SSRBook v1.

> **Trạng thái 13/10/2026: ĐẶC TẢ / KẾ HOẠCH, CHƯA CÓ APP ĐỌC ĐỘC LẬP, CHƯA CÓ APK.**  
> Epic: [Issue #20](https://github.com/xaxi2026/SSR-viet-truyen/issues/20). Các bản Pilot liên quan: [PR #13](https://github.com/xaxi2026/SSR-viet-truyen/pull/13), [PR #18](https://github.com/xaxi2026/SSR-viet-truyen/pull/18), [PR #19](https://github.com/xaxi2026/SSR-viet-truyen/pull/19); chưa mặc định đã merge.  
> Tên sản phẩm đề xuất: **SSR Đọc Truyện / SSR Reader**. Ứng dụng này dành cho độc giả, **không phải** phiên bản thu nhỏ của app tác giả.

## 1. Vì sao bắt buộc tách

Ứng dụng SSR-viet-truyen Writer chứa hoặc có thể mở: dàn ý tương lai, bản thảo chưa duyệt, bí mật tác giả trong **Hồ sơ cốt truyện**, gợi ý AI, tuyến/manh mối chưa tiết lộ, cấu hình mô hình và SQLite từng dự án. **Không được cấp quyền truy cập Writer cho độc giả**, ngay cả khi dùng nút ẩn các tab: ẩn UI không phải ranh giới bảo mật.

Ứng dụng độc giả phải có **mã nguồn/runtime, kho dữ liệu và quyền truy cập riêng**, chỉ nhìn thấy **bản công bố đã được tác giả phê duyệt**.

Sơ đồ dữ liệu:

```text
[SSR Writer — Windows, chỉ tác giả]
          |
          | tác giả chọn đúng chương, xem trước, bấm Công bố
          v
[Public Release Exporter — kiểm tra nguồn finalized, allowlist, không rò rỉ]
          |
          +----> SSRBook v1 / EPUB (không có SQLite/.vela/prompt)
                      |
                      v
            [SSR Reader Web/PWA độc lập] ---> offline storage của độc giả
                      |
                      +----> [Android app APK/AAB sau này]
                      +----> [iPhone PWA trước, native sau]
```

**Phát hành truyện không đồng nghĩa lưu lên Internet.** Giai đoạn đầu tác giả đưa file phát hành qua phương thức tự chọn; giai đoạn online/public hosting là quyết định riêng, phải có quyền chủ động và xác nhận phạm vi.

## 2. Tình trạng mã nguồn thực tế hiện tại

Đã có **màn hình đọc bên trong Writer**, không phải ứng dụng độc lập:

- `src/components/editor/ManuscriptReader.tsx` có danh sách chương đã chốt, qua chương, tìm kiếm, dấu trang, tiến độ, giao diện sáng/sepia/tối, cỡ chữ, chiều rộng và chế độ tập trung.
- `src/components/editor/reader-library.ts` lưu tùy chọn và tiến độ đọc **trên thiết bị**, không tự đồng bộ; cách nhận diện dùng đường dẫn project/manuscript là **không phù hợp** để công bố cho độc giả; thay bằng public bookId/chapterId.
- `src/components/editor/reader-navigation.ts` chỉ chọn chương `finalized`.
- Biên bản có thật: `docs/READER_COMPLETION_ACCEPTANCE_2026-10-13.md`; các bài E2E mới là chứng cứ cho màn hình **trong Writer**.
- `src/components/dialogs/ExportDialog.tsx` hỗ trợ `merged-md`, `split-md`, `txt`, tùy chọn `includeOutline` **mặc định bật**. **Cấm dùng nguyên output tùy chọn này làm gói phát hành công khai**.
- `src/services/export-service.ts` và `electron/services/manuscript-publisher.ts` có logic snapshot/bản thảo đã chốt cần được kiểm tra và tái sử dụng **có chọn lọc** khi làm bộ xuất bản an toàn.

Do đó hiện **chưa có**: bộ xuất gói an toàn theo hợp đồng bên dưới, repo/app mobile độc lập, URL tải app, APK đã build, server truyện công khai hoặc đồng bộ bookmark.

## 3. Kiến trúc dự kiến và ranh giới mã nguồn

### 3.1. SSR Writer (giữ nguyên)

- Writer đọc dữ liệu `.vela`/SQLite riêng tư. Chỉ **main process** đọc finalized snapshot qua repository/service sẵn có và xử lý lựa chọn công bố.
- Nút mới: **Xuất bản cho độc giả** đặt riêng với nút **Xuất dự án**; phải liệt kê **chỉ** các chương đang `finalized`, mặc định **không chọn chương nào**.
- Khi phát hành tác giả xem trước tên sách, mô tả, bìa, danh sách số chương, nội dung và hash từng chương, chọn thủ công rồi xác nhận **đúng phiên bản**. Nếu finalize/snapshot thay đổi trong lúc duyệt → từ chối và buộc xem lại.
- Quản lý biên nhận phát hành tối thiểu: `bookId` công khai mới (không dùng local path/ID dự án), `releaseVersion`, danh sách `chapterId` công khai, content hash, thời điểm, tác giả xác nhận. Biên nhận lưu **phạm vi riêng** của Writer.
- Không tự phát hành chương mới khi tác giả tiếp tục finalize. Không tự chuyển dữ liệu lên server/GitHub.

### 3.2. SSR Reader (repo và app tách biệt)

- Tạo **repository độc lập** đề xuất `xaxi2026/SSR-viet-truyen-reader` *khi tác giả đồng ý tạo repo và được cấp quyền*. Tại thời điểm viết tài liệu, **chưa tạo repository đó**.
- Ưu tiên React + TypeScript + Vite + PWA. Có thể trích **UI thuần** từ ManuscriptReader theo điều khoản bản quyền phù hợp, nhưng phải loại bỏ mọi dependency `electron`, `ipc`, `project-store`, `draft-store`, `AGENTS`, Writer router, SQL và model API.
- Reader chỉ mở **SSRBook v1 đã xác minh**. Dữ liệu của độc giả lưu IndexedDB/Cache Storage tùy nền tảng, không dùng dữ liệu dự án tác giả. Tiến độ/bookmark theo `publicBookId + publicChapterId + contentVersion`.
- UI tối thiểu: **Tủ sách**, nhập sách, mục lục, tìm chương, trang đọc, chương trước/sau, đánh dấu, tiếp tục, tiến độ, font/spacing/theme, đọc offline, xoá sách khỏi điện thoại.
- Kiểm tra web bằng HTTPS, manifest, service worker, chiến lược cập nhật an toàn. Offline chỉ được cam kết khi tài nguyên app và sách đã import thực sự được lưu; không giả định người dùng mở web một lần là chắc chắn đã đủ dữ liệu.

### 3.3. Điện thoại

- **Mốc đầu — PWA:** người dùng Android/iPhone mở website riêng và thêm vào màn hình chính (có thể dùng như app sau khi cài). Cần hosting HTTPS cho phân phối qua web, nhưng **không bắt buộc có backend hay tài khoản** nếu chỉ import file.
- **Mốc hai — Android:** đóng gói cùng UI bằng Capacitor (nếu kiểm thử file import, lưu offline trên thiết bị đạt), xây APK thử nghiệm riêng cho tác giả; AAB/phát hành Play Store là bước khác, cần signing và tuân thủ quy định store.
- **Mốc ba — iPhone:** ưu tiên PWA; native iOS cần môi trường build, ký ứng dụng và phân phối hợp lệ. Không hứa có IPA hay App Store ngay.
- **TTS/audio:** tùy chọn sau này, **không thuộc MVP**. Nếu làm phải xác định engine, quyền lưu/phát âm thanh và chi phí riêng.

Tham khảo kỹ thuật (không là bằng chứng đã cài): [MDN PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [Capacitor getting started](https://capacitorjs.com/docs/getting-started). Kiểm tra phiên bản SDK và hỗ trợ thiết bị tại lúc thực thi.

## 4. Hợp đồng trao đổi SSRBook v1 (DỰ THẢO)

**Nguyên tắc:** Writer tạo đối tượng **mới bằng danh sách trường cho phép**; không copy `draft`, `project`, `StoryBibleEntry`, `NarrativeThreadView` hay `ExportProjectSnapshot` vào gói đọc rồi xóa bớt.

Ví dụ cấu trúc khả dĩ (chỉ dùng dữ liệu giả):

```text
book.ssrbook  (ZIP nhỏ, giới hạn kích thước)
  manifest.json
  chapters/
    ch-000001.txt
    ch-000002.txt
  assets/
    cover.webp  (tuỳ chọn; phải được duyệt)
```

`manifest.json` (hợp đồng public, ví dụ **giả lập**):

```json
{
  "format": "ssrbook",
  "schemaVersion": 1,
  "bookId": "public-book-id-example",
  "releaseVersion": 1,
  "title": "Truyện ví dụ",
  "authorDisplayName": "Tác giả",
  "description": "Mô tả dành cho độc giả, do tác giả duyệt.",
  "writingLanguage": "vi-VN",
  "chapters": [
    {"id":"ch-000001","number":1,"title":"Khởi đầu","file":"chapters/ch-000001.txt","sha256":"<64 lowercase hex chars>"}
  ]
}
```

- Manifest phải có schema đóng (`additionalProperties: false` ở mọi cấp); reject metadata lạ, bản không hỗ trợ, chapter trùng, file thiếu/hash sai, path traversal, symlink, file thực thi, dữ liệu không UTF-8, kích thước quá giới hạn, archive bomb.
- Gói **chỉ** chứa văn xuôi chương đã công bố và metadata/tài nguyên đã duyệt. Không được có `.vela`, `.db`, `.sqlite`, backup, đường dẫn máy, tên máy, commit hash nhạy cảm, prompt, cấu hình LLM/API key, story Bible, kiến trúc, dàn ý/blueprint, notes, candidate/draft/review, sự kiện chưa công bố, bộ truy hồi và tóm tắt nội bộ.
- **Văn xuôi tự nó có thể chứa spoiler do tác giả viết**; export tự động không thể phát hiện hoàn toàn. Phải yêu cầu tác giả **preview nội dung chính xác**. Nếu có scan chỉ xem đó là defense-in-depth, không coi scanner thay cho duyệt.
- `sha256` chống lỗi/tamper vô tình, **không xác thực danh tính nhà phát hành** nếu không có chữ ký và khóa tin cậy. Chống phân phối giả mạo là giai đoạn sau.
- Reader render bằng text/Markdown an toàn, không HTML/JS thô, không truy cập file ngoài gói và không fetch URL bên thứ ba mặc định (kể cả asset trong metadata).
- Có thể bổ sung **EPUB** như đầu ra chuẩn cho các ứng dụng đọc ebook khác; EPUB cũng phải xuất từ **cùng snapshot công khai đã được duyệt**. Không gửi ZIP sao lưu dự án cho độc giả.

### 4.1. Điều kiện đủ để một chương xuất hiện

```text
is_currently_finalized(chapter_snapshot)
AND author_explicitly_selected_for_release(chapter_snapshot_hash)
AND release_confirmation_still_matches_source_revision
=> include in public package
```

`finalized` **không có nghĩa là** `published/public`. Dàn ý dù đã duyệt, bản nháp/revision và kế hoạch chỉ thuộc Writer.

## 5. Mối đe dọa và ca kiểm tra bắt buộc

| Rủi ro | Phòng vệ / tiêu chí |
|---|---|
| Rò rỉ bí mật qua metadata gói | Schema allowlist, output fixture có marker bí mật, kiểm tra toàn bộ byte ZIP/EPUB trước xuất |
| Xuất nhầm dàn ý | Không gọi exporter cũ với `includeOutline`; new public DTO không có trường outline |
| Lấy file `.vela` của máy tác giả | Reader không có IPC/filesystem path tới Writer; không nhận nhập SQLite/backup |
| Chương nháp được xem là hoàn chỉnh | Kết hợp finalized snapshot + người duyệt + snapshot hash ở thời điểm xuất |
| Dữ liệu thay đổi lúc phát hành | Transaction hoặc snapshot/guard và xác nhận lại; fail closed |
| Cấu trúc ZIP độc hại | Giới hạn kích thước, số file, tỉ lệ nén, path/case, hash, MIME, chống script/HTML/URL độc hại |
| Vô tình đưa secrets vào code repo | Chỉ commit test **giả lập**; CI rà dữ liệu fixture/zip; không commit câu chuyện thật |
| Sách đổi nội dung làm hỏng bookmark | Public IDs ổn định, migration theo chapter/version, không tự overwrite đọc dở |
| Người đọc tải nhầm bản rút lại | Release metadata/version. File đã trao không thể thu hồi khỏi thiết bị từ xa |
| Bài đọc 500 chương tải chậm | Tách file chương, đọc lazy, index từ mục lục, test offline/scroll/bookmark |

**Bộ kiểm thử không thể thiếu:** 1 chương, 100 chương và 500 chương **giả lập**; chứa marker secret trong Story Bible, author notes, dàn ý và draft; chứng minh package sạch, import hợp lệ; file sai/hỏng bị chặn; Android thật/Safari mobile smoke.

## 6. Quy tắc dự án và mốc triển khai

| Mốc | Phạm vi | Điều kiện đạt |
|---|---|---|
| M0 | Đặc tả + Issue + bàn giao ChatGPT | Tài liệu được theo dõi trên GitHub, không tuyên bố đã làm app |
| M1 | Safe Publish trong SSR Writer | Chỉ xuất finalized đã chọn; UI duyệt, hash, schema và leak test |
| M2 | SSR Reader PWA độc lập | Import, offline, reader UX, test mobile; không có Writer module |
| M3 | Android APK thử | Build riêng, chạy Android thật, file picker/offline ổn |
| M4 | iOS PWA/native tùy nguồn lực | Safari/PWA nghiệm thu trước, native sau khi có điều kiện |
| M5 | Catalog server, cloud sync, TTS | Chỉ khi được duyệt và có tài liệu riêng |

**Chưa quyết định:** app công khai hay chỉ gia đình/nhóm, nơi phân phối file/website, thiết kế thương hiệu, Android vs iPhone ưu tiên; các lựa chọn này ảnh hưởng M2–M4 nhưng **không ngăn việc định nghĩa schema, threat model và phát triển M1/MVP offline**.

## 7. Điều kiện đặc biệt về license và release

Repo Writer kế thừa dự án `EthanYoQ/AI-Novel-Writer` với GPL-3.0. Khi tái sử dụng mã UI Writer cho Reader, phải kiểm tra nghĩa vụ GPL-3.0, giữ ghi công/giấy phép và phân phối mã tương ứng phù hợp. **Không giả định** code được sao chép có thể đóng nguồn tùy ý. Các icon, tài nguyên khác phải được xem giấy phép riêng.

Không đăng tải nội dung truyện thật, dữ liệu tác giả, API key, ảnh riêng, profile browser, SQLite hoặc thư mục `test-1` lên GitHub.

## 8. Tham chiếu làm việc

- [Issue #20 — SSR Reader độc lập](https://github.com/xaxi2026/SSR-viet-truyen/issues/20)
- [Hướng dẫn triển khai và chuyển giao](SSR_READER_APP_DEVELOPMENT_GUIDE.md)
- [Nghiệm thu màn hình Reader trong Writer](READER_COMPLETION_ACCEPTANCE_2026-10-13.md) (**khác** nghiệm thu app độc lập)
- [Dữ liệu finalized và bản thảo vật lý](adr/0003-finalization-commit-and-manuscript-publication.md)
