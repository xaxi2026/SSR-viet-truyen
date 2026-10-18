# SSR Reader — Bước tiếp theo và tiêu chí nghiệm thu

**Đến 18/10/2026:** tác giả đồng ý sơ bộ với UI Stage 2.2 và Stage 3; chiến lược dài hạn chuyển sang **một app / một tài khoản có quyền theo tác phẩm**, chưa cần file khóa cục bộ trong UX đích. Pilot cũ không phải bản release.

| Ưu tiên | Việc cần làm | Nghiệm thu |
| --- | --- | --- |
| P0 | Đối chiếu, sao lưu và chuẩn hóa nguồn Stage 3; quyết định repo lưu source Reader, tách khỏi Writer và dữ liệu | Git status sạch/xác minh được, test build từ source, không leak key/chapters/ZIP |
| P1 | Thiết kế UI một app: **Tủ truyện / Tác phẩm của tôi**, giữ luồng Tủ → Thông tin → Đọc và từ điển | Reader không sửa nội dung chính thức; vùng biên tập chỉ dành cho tác phẩm được quản lý |
| P1 | Bỏ trải nghiệm chọn .pem thủ công cho workflow tác giả local (migration thận trọng) | Tác giả quản lý truyện demo, không mất lịch sử/chữ ký cũ; không gọi local switch là bảo mật đa người |
| P2 | Chuẩn hóa work ID, chapter, metadata, cover, asset, từ điển, revision; kết nối xuất từ Writer sang Reader | Không trộn dữ kiện giữa truyện, bản nháp khác canon, dữ liệu có mốc spoiler đúng |
| P2 | Ảnh minh họa do tác giả quản lý (upload/preview/remove; ChatGPT chủ động) | Ảnh tùy chọn; không lộ ảnh chưa mở; không tự gửi bản thảo; ảnh không hợp lệ bị từ chối |
| P3 | Login + backend khi chuẩn bị phát hành công khai | Một user đọc mọi truyện public nhưng chỉ sửa own work; API kiểm tra ownership, test IDOR, private/draft isolation |
| P4 | Update app và rollback, backup/migration | Nâng cấp/khôi phục không mất ghi chú/tiến độ/ảnh được phép, tương thích ZIP cũ |
| P5 | Audio TTS tiếng Việt, đồng bộ đa thiết bị, mobile sau desktop | TTS không đổi chữ; sync opt-in, conflict không ghi đè im lặng; kết quả test thực |

## Nguyên tắc triển khai

- Khi sang chat mới, **chỉ đọc và kiểm tra trước**, rồi hỏi tác giả hạng mục nào được phép triển khai.
- Không tự merge/push code, cập nhật bản chính, sử dụng máy công ty hoặc can thiệp truyện gốc/test-1.
- Dùng bản sao và dữ liệu giả lập. Mỗi giai đoạn cần acceptance criteria, unit + Electron E2E, backup hash, checkpoint và báo cáo PASS/FAIL.
- Đừng ngầm coi mẫu mã “123” là cơ chế phân quyền thật; app phát hành phải xác thực tài khoản và kiểm tra quyền phía backend.
- Đừng ghi canon từ suy luận AI; tác giả duyệt nội dung và ảnh.
- Giữ từ điển spoiler-safe: chỉ mở khi đã hoàn thành các chương **liên tiếp từ đầu**.
- Video anime từng nghiên cứu nhưng tạm hoãn; ưu tiên hoàn thiện Reader desktop, metadata và auth trước.

## Điểm chưa chốt, hỏi đúng lúc

- Giữ Author Studio như một process/module riêng lúc pilot hay tích hợp chung một EXE từ P1?
- Khi tới P3 mới chọn phương thức đăng nhập, server, chi phí hosting, vai trò cộng tác viên; không tự triển khai cloud.
- Có tiếp tục TTS VieNeu-TTS hay chọn giọng khác? Cần thử chi phí/cấu hình/giấy phép trước.

**Mọi báo cáo “đã triển khai” phải nêu máy, bản sao, test cụ thể, branch/SHA nếu có.**
