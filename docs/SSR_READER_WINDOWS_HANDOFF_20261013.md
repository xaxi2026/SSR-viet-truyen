# SSR Reader Windows — biên bản giao việc và nghiệm thu Pilot (13/10/2026)

## Quyết định thứ tự của tác giả

**1. Tách Reader chạy riêng trên Windows. 2. Quay lại sản xuất truyện. 3. Mobile/PWA/Android/iPhone sau.**

Không triển khai ứng dụng điện thoại trước khi hoàn tất đợt sản xuất truyện, trừ khi tác giả đổi ưu tiên. Ghi rõ quyết định này trong [Issue #20](https://github.com/xaxi2026/SSR-viet-truyen/issues/20).

## Tình trạng code đã làm

- [PR nháp #22 — standalone Windows Reader](https://github.com/xaxi2026/SSR-viet-truyen/pull/22), branch `feat/ssr-reader-desktop-20261013`. **Chưa merge.**
- Thư mục `apps/ssr-reader-desktop/` là Electron app **độc lập**, không import SSR Writer runtime/SQLite/.vela/Story Bible/AI.
- Máy Windows thử đã có **SSR Reader.exe** dạng **portable pilot**, không cần mở SSR Writer hoặc chạy Node/npm để đọc; có shortcut Desktop riêng.
- Đọc offline TXT do người dùng tự chọn qua hộp thoại OS; nhiều chương, thứ tự theo chương, tủ sách riêng, tìm trong chương, chuyển chương, dấu trang, cỡ chữ, chủ đề nền, lưu chương/vị trí cuối cùng và tiếp tục khi mở lại.
- Tính năng này hiện phục vụ **đọc cá nhân**, chưa phải quy trình công bố công khai truyện. Không tự biết TXT nào đã được tác giả phê duyệt. Khi cần gửi sách tới độc giả khác, phải xây Writer **safe public release exporter** rồi mới nói tới gói SSRBook/EPUB.
- Các tệp TXT được **sao chép** vào thư viện Reader độc lập, không sửa file gốc. Không cho người đọc mở project Writer hay truy cập dữ liệu dự án.
- Source test: `apps/ssr-reader-desktop/tests/reader-core.test.cjs`, E2E ở `tests/reader-e2e.cjs` chạy dùng **profile tạm riêng**.

## Bằng chứng (Windows Pilot)

| Kiểm tra | Trạng thái |
|---|---|
| Syntax main/preload/renderer | PASS |
| Node unit tests | **9/9 PASS**, gồm kiểm tra sắp xếp 500 chương giả lập |
| Electron + Playwright E2E | **PASS**: nhập TXT giả lập chương 1/2/10, điều hướng, tìm, dấu trang, nền tối, tắt/mở và trở lại chương đọc trước |
| Windows portable app | **PASS**: tiến trình `SSR Reader.exe` mở cửa sổ với Responding=True |
| Test source isolation | **PASS**: ứng dụng không import Writer IPC/storage/runtime |
| Đóng gói installer Windows / chữ ký | **CHƯA** |
| QA trực quan thủ công do tác giả | **CHỜ DUYỆT** |
| Đồng bộ Reader trên điện thoại/cloud | **CHƯA / ƯU TIÊN SAU** |

Trong E2E chỉ dùng truyện **giả lập**, không lấy dữ liệu `test-1` hay tác phẩm thật. Bản Writer và Pilot Story Bible giữ nguyên.

## Hướng dẫn tác giả trải nghiệm trên máy đang thử

1. Mở shortcut **SSR Reader - Doc truyen (Pilot)** trên Desktop Windows.
2. Nhập tên sách tùy ý, bấm **+ Nhập chương TXT**.
3. Chỉ chọn các chương TXT **bạn muốn đọc**, không chọn file dàn ý, hậu trường, bí mật hoặc ZIP sao lưu project.
4. Thử Mục lục, Trước/Sau, tìm nội dung, đánh dấu, font, nền tối. Đóng và mở lại để nghiệm thu tiến độ/đọc tiếp.
5. Nếu muốn chuyển Reader sang máy khác, phải mang **cả thư mục portable và sách nhập theo cách hợp lệ**; **không chuyển Reader bằng cách đưa cả project Writer/.vela**.

**Lưu ý:** Reader pilot lưu thư viện riêng trong thư mục ứng dụng người dùng Windows; có thể trống dù Writer có chương. Muốn đọc chương thật, cần nhập các tệp TXT được tác giả lựa chọn. Đây không phải dấu hiệu mất truyện.

## Chỉ dẫn cho ChatGPT ở chat tiếp theo

Khi user nói **"tiếp tục sản xuất truyện"**:
- Trước tiên đọc trạng thái thực trên **máy/dự án được họ chỉ định** và hướng dẫn [quy trình tạo truyện](../CHATGPT_START_HERE.md) trên nhánh PR #13/#19 thích hợp. Đừng suy ra số chương từ issue hay ghi chép.
- Phân biệt **dàn ý đã duyệt**, **blueprint đã nhập**, **bản nháp**, **chương finalized**. Không tự chốt, không nhập/chạm `test-1` nếu chưa được chỉ định và cho phép.
- **Không chuyển sang phát triển mobile**, trừ khi tác giả yêu cầu lại. Giữ Reader Windows tách riêng và không ảnh hưởng workflow Writer.
- Reader Windows chưa có **an toàn phát hành công khai**; không share TXT hoặc repo như thể là bộ xuất bản truyện hoàn chỉnh.

Các tài liệu nền: [hướng dẫn mới cho ChatGPT](../SSR_READER_START_HERE.md), [kiến trúc Reader](SSR_READER_APP_ARCHITECTURE.md), [kế hoạch dài hạn](SSR_READER_APP_DEVELOPMENT_GUIDE.md).

## Nâng cấp giao diện tối và đồng bộ Reader Writer (13/10/2026)

Theo ảnh nghiệm thu ban đầu, UI Reader cũ bị **khung trắng / trang đọc đen** không đồng bộ. Đã thực hiện tại [PR nháp #22](https://github.com/xaxi2026/SSR-viet-truyen/pull/22), commit `0aca82848e4be6650ac163d81b2a671aeee30182`:

- **SSR Reader Windows dùng giao diện tối hoàn toàn**, kể cả thanh tiêu đề Windows, Tủ sách, Mục lục, các tab điều khiển, thanh công cụ và chân trang. Đọc đêm dùng palette `#1b2029 / #e4e7ee` giống `ManuscriptReader.tsx` trong SSR Writer.
- Bố cục/phím đọc dựa trên Writer: **Trước, Sau, Mục lục, Tìm, Đánh dấu, Đã lưu, Hiển thị, Chế độ tập trung**, bảng phụ đóng/mở, chuyển chương dưới bài, thanh tiến độ.
- Có đủ cỡ chữ, giãn dòng, khổ trang, nền đêm/trắng/vàng; **nền khung ứng dụng vẫn tối** khi đổi màu trang đọc. Tự lưu và nhớ chương cuối.
- Sửa tiêu đề TXT lặp `Chương n · Chương n`, chỉ loại bỏ tiêu đề trùng **khi hiển thị**, không thay nội dung file TXT gốc.
- Bằng chứng: **10/10 unit tests PASS**; **Playwright Electron E2E PASS** với chương giả lập, kiểm tra năm vùng giao diện đều có màu tối, bookmarks, search, focus, settings, resume. Bản portable trên VCC-PHUONG23 đã khởi động lại với cửa sổ phản hồi.

**Tình trạng:** đã cập nhật bản Pilot và GitHub; vẫn **chưa** là bản installer phát hành chính thức/chưa nghiệm thu trực quan lần cuối từ tác giả. Không merge tự động. Sau khi tác giả xác nhận, quay lại tiếp tục sản xuất truyện; ứng dụng điện thoại sau.
