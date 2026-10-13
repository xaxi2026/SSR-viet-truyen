# SSR-viet-truyen — Liên kết tình tiết gợi mở, Hồ sơ cốt truyện và tuyến truyện

**Ngày:** 13/10/2026
**Nhánh:** `feat/linked-foreshadowing-tracks-20261013` (phát triển từ Story Bible Pilot).

## Đã triển khai — giai đoạn 1

1. Một **kế hoạch manh mối/tình tiết gợi mở** có thể liên kết với một **Hồ sơ cốt truyện** đã tồn tại. Nhiều manh mối có thể dùng chung một hồ sơ, ví dụ ba manh mối cùng phục vụ bí mật ở chương 150.
2. Trong màn hình **Danh sách manh mối** có ô chọn hồ sơ liên kết. Khi sửa manh mối, liên kết được giữ. Người dùng có thể chọn “Không liên kết” để gỡ liên kết.
3. Thẻ manh mối hiển thị hồ sơ liên kết, **chương gieo**, **chương được phép tiết lộ** và **các mốc giải đáp** từ hồ sơ. Có nút mở Hồ sơ cốt truyện để tác giả đối chiếu.
4. Trong **Sơ đồ cốt truyện**, khi chọn sự kiện có nguồn là một kế hoạch manh mối đã liên kết, nguồn này được gắn nhãn “↔ Hồ sơ cốt truyện”; nhấp nguồn sẽ đưa về kế hoạch manh mối, từ đó tác giả mở hồ sơ được. Không thêm bí mật vào nội dung sơ đồ.
5. Giữ hệ thống theo dõi trạng thái hiện có: dự kiến, đã gieo, đang phát triển, đã giải đáp, bỏ; cảnh báo trễ và bị bỏ quên. Sự kiện được xác nhận dựa trên đoạn trích của chương **đã chốt**.
6. Tạo bảng liên kết riêng `narrative_story_bible_links` trong database. Không thay đổi hay thay thế các hàng đã có trong bảng kế hoạch/các sự kiện. Khóa ngoại ràng buộc mã hồ sơ thuộc **chính database dự án đang mở**; mọi thao tác thêm/sửa liên kết nằm trong một transaction. Xóa hồ sơ sẽ tự gỡ liên kết nhưng **không xóa kế hoạch và sự kiện**. Cập nhật từ luồng cũ nếu không gửi trường liên kết sẽ giữ nguyên liên kết.
7. Chỉ mang `linkedStoryBibleId` (số ID) vào cấu trúc kế hoạch; **sự thật bí mật, hiểu lầm và người biết/chưa biết không được ghép tự động vào prompt viết hoặc prompt tạo Sơ đồ cốt truyện**. Đây là công cụ sắp xếp tư liệu của tác giả, **chưa phải cơ chế bảo vệ chống lộ bí mật tự động**.

## Kiểm thử đã thực hiện

- `tsc --noEmit`: PASS.
- ESLint toàn bộ repo: PASS.
- `check-i18n-coverage`: PASS.
- Vitest chạy qua Electron/Node ABI 145 với cơ sở dữ liệu **giả lập mới ở thư mục test**, không đụng SQLite dự án thật: **87/87 PASS**, gồm kiểm thử mới cho liên kết nhiều-một, lưu/đóng/mở lại, bỏ liên kết, xóa hồ sơ, ID giả và không xuất nội dung bí mật trong context.
- Chưa được coi là hoàn chỉnh cho sản xuất: cần smoke test giao diện do tác giả nghiệm thu, kiểm thử dùng chung các dự án lớn trước khi chấp nhận nâng cấp bản mặc định.

## Những việc giai đoạn 2 cần làm riêng

- Liên kết thủ công *trực tiếp* với ID tuyến **chính/phụ** được AI sinh trong Sơ đồ: hiện ID AI có thể đổi mỗi lần tạo lại nên **không tự lưu quan hệ vĩnh viễn dựa trên ID ấy**. Bước hiện tại liên kết tới **nguồn manh mối** của sự kiện Sơ đồ để giữ được đường dẫn bền.
- Tạo preview chương chỉ từ gợi ý an toàn và trích dẫn đã được tác giả duyệt; kiểm thử phát hiện tình tiết lộ trước chương dự kiến, có checkpoint và quyền duyệt rõ ràng.
- Tự động đánh giá độ trễ/căng nhịp từng tuyến và đưa ra đề xuất, nhưng không tự sửa canon, sự kiện đã chốt hay bản thảo.
- UI/E2E trên dự án thử riêng, migration test nhiều phiên bản và đóng gói Windows.

**Cấm:** sửa `test-1`, nhập bí mật vào AI từ kho hồ sơ không có xác nhận, merge GitHub vào `master` hoặc thay bản SSR cũ mà tác giả chưa duyệt.

## Bản xem thử tại máy công ty

- Vite production build: **PASS**; sinh `dist/index.html` và `dist-electron/main.js` trên nhánh tính năng.
- Đã tạo lối tắt độc lập **SSR-viet truyen - Manh moi va tuyen truyen (Pilot)** trên Desktop. Bản Electron mới chạy được, cửa sổ `Responding: True`, không dùng `pnpm dev`.
- Launcher: `D:\SSR-NGHIA\Start SSR-viet truyen - Manh moi va tuyen truyen (Pilot).cmd`.
- Profile riêng: `D:\SSR-NGHIA\SSR-Foreshadow-Preview-Profile`. Danh sách dự án gần đây có thể trống; không nhập hoặc sửa dữ liệu truyện thật khi chưa nghiệm thu.
- Bản SSR chính thức, `test-1` và lối tắt Pilot Hồ sơ cốt truyện trước đó không bị thay thế. Không thay đổi Kaspersky.
- Đã chạy cả 2 bài kiểm thử `story-bible-repository` bằng cách dùng **Electron as Node** (ABI 145), không rebuild ghi đè thư viện SQLite của app.
