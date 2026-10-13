# Việt hóa giao diện SSR — kiểm tra 13/10/2026

## Phạm vi đã cập nhật

Đã bổ sung từ điển dùng chung `src/i18n/vi-story-bible.ts` và `src/i18n/vi-workflow-extra.ts`, được gọi bởi `localize()` trong `src/i18n/core.ts` **chỉ khi giao diện đang đặt vi-VN**. Giữ nguyên en-US và zh-CN. Tên trường dữ liệu, prompt, tên mô hình, JSON/SQLite và nội dung truyện không bị thay đổi.

Đã bổ sung tiếng Việt cho Hồ sơ cốt truyện, danh sách manh mối, sơ đồ cốt truyện, cùng nhiều nút và thông báo tại duyệt bản thảo, nhân vật, viết chương, nhập truyện, tác vụ, kho tri thức, sao lưu và lịch sử phiên bản.

## Mức độ bao phủ thực tế

Kiểm kê bằng `D:\SSR-NGHIA\ssr-i18n-audit-20261013.py` (chỉ đếm các lệnh `text()` hai chuỗi viết cùng dòng trong TSX, không phải kiểm kê toàn bộ văn bản app): trong 1.378 lượt sử dụng tĩnh được đếm, đã có từ điển cho 836 lượt; **542 lượt chưa có bản dịch**. Còn cả chuỗi nhiều dòng, chuỗi dựng động, placeholder và thông báo lỗi ngoài tập đếm. Vì vậy **chưa được ghi nhận là Việt hóa 100%**.

Việc còn lại: trích xuất toàn diện JSX, chuỗi nhiều dòng, thông báo runtime và màn hình cấu hình; dịch và rà ngữ cảnh thủ công; kiểm thử visual/UI dưới vi-VN, sau đó mới xác nhận hoàn tất. Không dựa riêng vào `check:i18n` vì kiểm tra này chưa đo bao phủ nội dung tĩnh.

## Tách biệt và an toàn

Nhánh độc lập `feat/story-bible-20261013` trong `D:\SSR-NGHIA\SSR-viet-truyen-story-bible-20261013` trên máy công ty; bản cũ `D:\SSR-NGHIA\SSR-viet truyen` và dự án `test-1` không được chỉnh sửa. Lối tắt Pilot trên Desktop trỏ đến nhánh làm việc độc lập. Không merge hoặc push GitHub.
