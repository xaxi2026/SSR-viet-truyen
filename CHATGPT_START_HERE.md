# Bắt đầu một cuộc trò chuyện ChatGPT mới với SSR-viet-truyen

**Đây là điểm vào dành cho ChatGPT, không phải bản thảo truyện.**

- Repository: [xaxi2026/SSR-viet-truyen](https://github.com/xaxi2026/SSR-viet-truyen).
- Quy trình bắt đầu **một tác phẩm mới**: [docs/CHATGPT_NEW_NOVEL_PLAYBOOK.md](docs/CHATGPT_NEW_NOVEL_PLAYBOOK.md).
- Quy tắc lập trình/bảo toàn dữ liệu: [AGENTS.md](AGENTS.md).
- Đặc tả viết nhiều chương: [docs/CHATGPT_BATCH_WRITING_SPEC.md](docs/CHATGPT_BATCH_WRITING_SPEC.md).
- Tình trạng khả năng đã triển khai: [docs/CHATGPT_WORKSPACE_FOUNDATIONS.md](docs/CHATGPT_WORKSPACE_FOUNDATIONS.md) cùng các biên bản nghiệm thu mới hơn. Tài liệu cũ không tự trở thành bằng chứng phiên bản mới nhất.

## Cách dùng khi tạo chat mới

**Dán nguyên đoạn bên dưới vào cuộc trò chuyện mới** (thay tên máy nếu muốn làm ở máy khác):

> Tôi muốn bắt đầu một **truyện mới hoàn toàn** bằng SSR-viet-truyen. Hãy đọc repository `xaxi2026/SSR-viet-truyen`, trước tiên là `CHATGPT_START_HERE.md`, `AGENTS.md` và `docs/CHATGPT_NEW_NOVEL_PLAYBOOK.md` trên **nhánh PR #13 hiện hành nếu chưa merge**. Sử dụng GitHub và Remote Desktop Commander nếu các kết nối sẵn có; **chỉ làm việc trên laptop nghia khi tôi cho phép kết nối**. Đầu tiên hãy kiểm tra khả năng truy cập, mã nguồn, trạng thái ứng dụng và hỏi tôi ý tưởng truyện. Giúp tôi xây dựng tiền đề, thế giới, nhân vật, kế hoạch chương rồi trình tôi duyệt **từng giai đoạn**. Chỉ tạo thư mục/dự án mới sau khi tôi xác nhận tên và nơi lưu; không đụng dữ liệu `test-1`, không sửa hay truy cập máy công ty, không tự chốt chương, không tự merge GitHub. Nếu chức năng chưa triển khai, nói đúng giới hạn và đề nghị đường thực hiện an toàn.

Không cần cung cấp 500 chương, nội dung truyện, thông tin đăng nhập hoặc API key trong tin nhắn khởi đầu.

## ChatGPT phải hiểu ngay

1. **GitHub giữ mã nguồn, tài liệu và cách làm; không giữ tiểu thuyết riêng của tác giả.** Trong chat mới, không được tự tuyên bố đã biết truyện nào đó chỉ từ repo.
2. **Chat mới không tự đọc GitHub hay máy tính.** Phải có link/tên repo trong yêu cầu và công cụ được kết nối; đọc được đến đâu báo đến đó. Nếu không có quyền GitHub, yêu cầu người dùng cung cấp nội dung tài liệu, không bịa dữ liệu hoặc bảo rằng đã đồng bộ.
3. **Truyện mới có ID và thư mục hoàn toàn riêng.** Không dùng `test-1` làm template bằng cách sao chép cơ sở dữ liệu; không lấy 500 dàn ý của truyện cũ làm nội dung truyện mới.
4. **ChatGPT soạn đề xuất; tác giả duyệt.** Dàn ý không phải văn xuôi; bản nháp chưa phải chương chính thức; chương chính thức và ký ức truyện phải dựa trên dữ kiện đã được tác giả xác nhận.
5. Chỉ triển khai việc người dùng yêu cầu; không tự động viết tiếp hàng chục/hàng trăm chương, không hứa chạy nền.


---

## Nếu mục tiêu là TIẾP TỤC PHÁT TRIỂN SSR READER (không phải tạo truyện mới)

Đọc [SSR_READER_START_HERE.md](SSR_READER_START_HERE.md) trên nhánh tài liệu này, rồi đọc các kế hoạch và quy tắc phân quyền được liên kết ở đó. Lộ trình Reader Stage 0–3 và quyết định mới nhất **một tài khoản vừa độc giả vừa tác giả, quyền sửa theo từng tác phẩm** nằm trong docs/SSR_PRODUCT_MASTER_ROADMAP.md và docs/SSR_ACCOUNT_AUTHOR_READER_DECISIONS.md.

**Cần xác minh nguồn Reader thật trên laptop nghia khi được cho phép**: tài liệu GitHub không chứa source Reader Stage 3 chưa push và không cho phép tự truy cập máy công ty, tự sửa truyện gốc, tự merge hay đưa dữ liệu riêng lên repo.
