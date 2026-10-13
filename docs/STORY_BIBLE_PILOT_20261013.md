# Hồ sơ cốt truyện / Story Bible — 13/10/2026

Bản thử trên máy công ty, dùng lại cho mọi thể loại truyện.

- Bốn nhóm: bí mật tác giả, manh mối, quy tắc nhất quán, kiến thức nhân vật.
- Lưu sự thật tác giả, trạng thái xác thực, gợi ý không tiết lộ, người đã biết và chưa biết, niềm tin sai, chương gieo, chương được phép tiết lộ và nhiều mốc thu hồi.
- Dữ liệu nằm trong bảng `story_bible_entries` của SQLite từng dự án, đi cùng ZIP sao lưu chuẩn của SSR.
- Giữ nguyên các chức năng Narrative Threads và Plot Tree; không ghi dữ liệu vào truyện `test-1`.

**Giới hạn ở bản thử:** Thông tin riêng của tác giả chưa được đưa vào prompt viết truyện. Kiểm tra rò rỉ và nhất quán trước khi duyệt chương, nhập dàn ý theo lô và cơ chế hạn chế tiết lộ ở runtime là việc cần triển khai tiếp theo. Không đánh dấu sự thật chưa chốt là canon, không tự duyệt thay tác giả.

Mã nguồn: `D:\SSR-NGHIA\SSR-viet-truyen-story-bible-20261013` (nhánh `feat/story-bible-20261013`, nền `e5f8beb7`). Bản cũ: `D:\SSR-NGHIA\SSR-viet truyen`, giữ làm điểm quay lại.
