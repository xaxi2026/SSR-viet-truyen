# SSR Reader — Bắt đầu phát triển ứng dụng đọc truyện độc lập


> **ƯU TIÊN CẬP NHẬT 13/10/2026 — QUYẾT ĐỊNH CỦA TÁC GIẢ:** triển khai **ứng dụng SSR Reader riêng trên Windows trước**, nghiệm thu rồi **quay lại sản xuất truyện**. **PWA/Android/iPhone chuyển sang giai đoạn sau**. Các đoạn nhắc “PWA trước” bên dưới chỉ là phương án nghiên cứu cũ, **không còn là thứ tự triển khai**. Giai đoạn Windows cho phép **nhập TXT được tác giả chọn thủ công để đọc riêng trên máy**, không được quảng bá là xuất bản/publication. Khi cần chia sẻ cho độc giả mới phát triển Safe Release Exporter theo hợp đồng SSRBook v1.

**Trạng thái (13/10/2026): mới có thiết kế + Issue, CHƯA CÓ ứng dụng Reader độc lập, APK hoặc bản phát hành.**

Ứng dụng Writer để **sáng tác và giữ bí mật**. Ứng dụng SSR Reader để **đọc các chương được tác giả tự chọn công bố**, có thể dùng trên điện thoại. Hai sản phẩm **không được chia sẻ kho SQLite/.vela, IPC writer, dàn ý hoặc thông tin AI**.

## Tài liệu chính trên GitHub

- [Windows Reader Pilot: tình trạng, nghiệm thu và quay lại viết truyện](docs/SSR_READER_WINDOWS_HANDOFF_20261013.md).
- [PR #22: mã nguồn SSR Reader Windows độc lập](https://github.com/xaxi2026/SSR-viet-truyen/pull/22).
- [Issue #20 — Reader Windows trước, mobile sau](https://github.com/xaxi2026/SSR-viet-truyen/issues/20)
- [Đặc tả kiến trúc, bảo mật và SSRBook v1](docs/SSR_READER_APP_ARCHITECTURE.md)
- [Hướng dẫn triển khai + cách mở chat mới](docs/SSR_READER_APP_DEVELOPMENT_GUIDE.md)

Các tài liệu/bản tính năng liên quan hiện trên các **PR nháp chưa merge**: [#13](https://github.com/xaxi2026/SSR-viet-truyen/pull/13) (Reader trong Writer), [#18](https://github.com/xaxi2026/SSR-viet-truyen/pull/18) (Hồ sơ cốt truyện), [#19](https://github.com/xaxi2026/SSR-viet-truyen/pull/19) (liên kết manh mối). `AGENTS.md` và `CHATGPT_START_HERE.md` thuộc nhánh PR #13/#19, **chưa có trong nhánh `master` hiện tại**. Khi đọc phải chọn đúng ref, không mặc định mọi chức năng đã lên bản chính.

## Nhắn ChatGPT trong cuộc trò chuyện mới

> Tiếp tục dự án **SSR Reader — ứng dụng đọc truyện riêng trên điện thoại**, Issue #20 tại `xaxi2026/SSR-viet-truyen`. Hãy đọc `SSR_READER_START_HERE.md`, `docs/SSR_READER_APP_ARCHITECTURE.md`, `docs/SSR_READER_APP_DEVELOPMENT_GUIDE.md` trên nhánh tài liệu Reader và đối chiếu PR #13/#18/#19 trước khi làm. Tôi muốn tách hoàn toàn Reader khỏi app viết, chỉ cho phép độc giả mở các chương tôi chủ động công bố. Ưu tiên PWA trước rồi Android APK; iPhone dùng PWA trong giai đoạn đầu. Làm trên nhánh riêng, dùng dữ liệu giả lập; không chạm `test-1`, bí mật cốt truyện, bản nháp, API key hoặc máy chưa được tôi cho phép. Không tự công bố truyện hoặc merge PR. Báo cáo phần đã code, kiểm thử và phần còn là kế hoạch.

## Mốc làm việc

- **D2 Writer sau Windows:** xuất gói độc giả từ **finalized + tác giả chọn công bố + preview xác nhận đúng hash**; xuất riêng, không tái dùng Export hiện tại có `includeOutline`.
- **D0/D1 Windows Reader độc lập:** app web/PWA độc lập, tủ sách, nhập file, offline, mục lục, dấu trang, chỉnh cỡ chữ, tìm kiếm; không biết dữ liệu tác giả.
- **M3 Android (để sau viết truyện):** đóng gói APK thử nghiệm riêng; kiểm thử máy thật và file import.
- **M4 iPhone (để sau viết truyện):** cài PWA từ trình duyệt trước; native sau khi có môi trường ký và phân phối.

**Quan trọng:** GitHub chứa source và hướng dẫn **không chứa dữ liệu truyện riêng**. Muốn nhập sách thật để phát hành phải có thao tác công bố được chủ sở hữu chấp thuận; `finalized` riêng chưa phải `public`.
