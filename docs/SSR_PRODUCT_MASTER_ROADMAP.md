# SSR-viet-truyen — Lộ trình tổng Writer và Reader

**Chốt ngày 2026-10-18.** Phân biệt ba trạng thái: (A) có tài liệu/đã thiết kế; (B) đã làm pilot local/test; (C) đã phát hành chính thức. Không đồng nhất (B) với (C).

## 1. SSR Writer

- Sáng tác dài kỳ tiếng Việt: creative brief → thế giới/nhân vật và Story Bible → dàn ý/arc → bản nháp → đánh giá → tác giả duyệt/chốt → xuất bản.
- ChatGPT hỗ trợ lập kế hoạch/viết nhưng KHÔNG tự duyệt dữ kiện canon hoặc chốt chương. Bản nháp, kế hoạch, chương chốt có vòng đời riêng.
- Đọc docs/CHATGPT_NEW_NOVEL_PLAYBOOK.md, docs/CHATGPT_BATCH_WRITING_SPEC.md, AGENTS.md. 10 chương từ 101–110, mỗi chương mục tiêu 2.500 từ, là kịch bản kiểm thử batch, KHÔNG phải lệnh viết tự động.
- Giữ hỗ trợ vi-VN song song en-US/zh-CN. Không sửa/trộn dữ liệu dự án truyện cũ.

## 2. SSR Reader: mốc đã thử trên laptop (KHÔNG phải release công khai)

| Mốc | Nội dung | Kết luận |
| --- | --- | --- |
| Stage 0 | Backup ZIP v1/v2, restore thư mục riêng, checksum | Pilot local |
| Stage 1 | Bookmark, highlight/màu, ghi chú, vị trí, kiểu chữ | Pilot local |
| Stage 2 | Tủ sách, ảnh bìa, metadata, tìm toàn truyện, tiến độ | Pilot local |
| Stage 2.1 | Ba màn hình: Tủ truyện → Thông tin → Đọc | Pilot local |
| Stage 2.2 | Grid Figma 6 cột desktop, 12 cuốn/trang, test 100 cuốn, lọc/sắp xếp | Pilot local |
| Stage 3 | Từ điển nhân vật/địa danh/phe phái/cảnh giới/vật phẩm có ảnh tùy chọn, spoiler gate, Reader đọc và Author Studio pilot biên tập | Pilot local; Studio còn dùng file khóa .pem |

Thiết kế Figma: https://www.figma.com/design/Xt95ZSqAXy30LxAoZXfR4I

## 3. Quyết định sản phẩm MỚI NHẤT

- Mục tiêu là **một ứng dụng và một tài khoản** có thể vừa làm độc giả vừa làm tác giả. Người dùng chỉ sửa, thay ảnh và xuất bản đối với tác phẩm do chính họ sở hữu; truyện công khai của người khác chỉ đọc.
- Tiến độ, bookmark, ghi chú là dữ liệu độc giả riêng; thông tin canon, chương, bìa và ảnh từ điển là dữ liệu chính thức của tác giả.
- Hiện phát triển local KHÔNG cần nhập private-key .pem như UX thường ngày; khi phát hành nhiều người mới tích hợp đăng nhập và máy chủ kiểm tra quyền sở hữu cho từng request. Mã 123 chỉ là ví dụ, KHÔNG phải bảo mật phát hành.
- Ảnh từ điển tùy chọn, tác giả thêm hoặc tự tạo bằng ChatGPT và duyệt. Ảnh/mô tả chỉ mở khi hoàn thành liên tiếp chương từ đầu, không lộ spoiler nếu nhảy chương.
- Stage 3 đang chạy vẫn là pilot cũ sử dụng Ed25519/manual .pem; cần lên kế hoạch migration trước khi đổi.

## 4. Thứ tự phát triển tiếp

P0 bàn giao tái lập nguồn Reader và kiểm thử; P1 giao diện Tủ truyện/Tác phẩm của tôi + workflow tác giả local đơn giản; P2 dữ liệu canon/ảnh/từ điển/chapter theo work ID và xuất từ Writer sang Reader; P3 login/backend kiểm tra ownership, public/private, test truy cập chéo; P4 cập nhật phần mềm và rollback; P5 TTS tiếng Việt, sync đa thiết bị local-first, mobile khi cần. Tham khảo chi tiết docs/SSR_READER_NEXT_STEPS.md.

## 5. Backlog 11 tính năng Reader đã chọn

(1) tô màu/ghi chú; (2) điều hướng; (3) giao diện đọc; (4) thư viện/cover; (5) tìm toàn truyện; (6) thống kê/tiến độ; (8) từ điển chống spoiler; (10) backup/restore; (11) cập nhật app; (12) TTS tiếng Việt; (13) sync. Các tính năng đã pilot ≠ đã hoàn tất bản chính. TTS VieNeu-TTS giọng Hải Đăng chỉ từng lên kế hoạch/thử nghiệm, phải xác minh hiện trạng; AI video anime 2D từng nghiên cứu nhưng tạm hoãn vì chi phí/đòi hỏi cấu hình.

## 6. Nguyên tắc

Không đụng truyện gốc, test-1, máy công ty hoặc Writer khi chỉ sửa Reader; chỉ phát triển trên bản sao laptop nghia sau khi người dùng cho phép; không push source chưa duyệt hoặc merge. GitHub công khai không được chứa tiểu thuyết riêng, SQLite, backup, private key.
