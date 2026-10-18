# SSR Reader — Điểm vào để tiếp tục ở chat ChatGPT mới

**Cập nhật 2026-10-18.** Đây là bản bàn giao QUYẾT ĐỊNH + LỘ TRÌNH, không phải bản phát hành Reader. Đọc trên nhánh docs/ssr-reader-handoff-roadmap-20261018 của xaxi2026/SSR-viet-truyen; không giả định nhánh master đã có nội dung này.

## Tài liệu cần đọc, theo thứ tự

1. AGENTS.md — bảo toàn dữ liệu, nguyên tắc tác giả duyệt.
2. docs/SSR_PRODUCT_MASTER_ROADMAP.md — Writer + Reader, các giai đoạn.
3. docs/SSR_READER_STATE_HANDOFF.md — vị trí Reader trên laptop và trạng thái đã kiểm thử.
4. docs/SSR_ACCOUNT_AUTHOR_READER_DECISIONS.md — quyết định đăng nhập/quyền theo tác phẩm, thay thế hướng khóa thủ công.
5. docs/SSR_READER_NEXT_STEPS.md — bước tiếp và tiêu chí nghiệm thu.
6. Nếu mục tiêu là **bắt đầu viết một truyện mới**, dùng CHATGPT_START_HERE.md và docs/CHATGPT_NEW_NOVEL_PLAYBOOK.md, không dùng playbook Reader.

## Đoạn lệnh cho chat mới

> Tiếp tục dự án SSR Reader thuộc xaxi2026/SSR-viet-truyen. Đọc nhánh docs/ssr-reader-handoff-roadmap-20261018, các tài liệu SSR_READER_START_HERE.md, AGENTS.md, SSR_PRODUCT_MASTER_ROADMAP.md, SSR_READER_STATE_HANDOFF.md, SSR_ACCOUNT_AUTHOR_READER_DECISIONS.md và SSR_READER_NEXT_STEPS.md. Không coi kế hoạch là mã đã viết. Mã Reader Stage 3 vẫn là bản sao local trên laptop nghia, chưa được tự động đưa lên GitHub. Khi tôi cho phép, kết nối Remote Desktop Commander với **nghia**, xác minh read-only nguồn và kiểm thử trước; không đụng VCC-PHUONG23/máy công ty, không sửa truyện gốc/test-1, không tự push/merge. Định hướng mới nhất: một tài khoản có thể vừa đọc vừa viết, mỗi tác giả chỉ sửa tác phẩm thuộc quyền của mình; Reader ghi chú riêng; local hiện chưa cần khóa thủ công, phát hành nhiều người phải xác thực và kiểm tra quyền phía máy chủ. Hãy báo trạng thái đã xác minh rồi hỏi tôi công việc kế tiếp.

## Ranh giới thông tin và an toàn

- GitHub repository hiện CÔNG KHAI: chỉ ghi tài liệu, đặc tả và source/test được cho phép. Tuyệt đối không push chapters, SQLite/.vela, ZIP sao lưu, file .pem/private key, API token, profile hoặc ảnh riêng của tác giả.
- Reader Stage 3 pilot nằm trên laptop nghia, **không phải nguồn đã push lên repo Writer**. Phải kết nối máy được người dùng cho phép để kiểm tra lại.
- Không dùng máy công ty; không tự duyệt, chốt chương, xuất bản, reset working tree, merge hoặc deploy.
- Không suy đoán rằng báo cáo test ngày 18/10/2026 phản ánh trạng thái hiện tại khi mở chat trong tương lai.
