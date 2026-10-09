# VI-002 — Chế độ sáng tác tiếng Việt (bản triển khai đầu)

## Phạm vi đã thực hiện

- Thêm `vi-VN` vào `WritingLanguage` của dự án. Ngôn ngữ giao diện (`Locale`) và ngôn ngữ sáng tác được lưu/điều khiển riêng.
- Dự án mới tạo trong giao diện `vi-VN` mặc định sáng tác tiếng Việt. Dự án đã tồn tại giữ nguyên ngôn ngữ được ghi trong cấu hình; giá trị cũ không hợp lệ tiếp tục dùng mặc định `zh-CN`.
- Người dùng có thể chọn **Tiếng Việt** trong **Cấu hình truyện → Ngôn ngữ sáng tác** và trong **Cài đặt → Mẫu lời nhắc AI**.
- Bộ prompt tiếng Việt áp dụng cho 21 khóa của luồng sáng tác cốt lõi, kèm trợ lý viết và các thao tác xây dựng hồ sơ nhân vật. Giữ nguyên hợp đồng JSON/placeholder và dữ kiện đã được duyệt; tầng hướng dẫn tiếng Việt ưu tiên văn phong tự nhiên, cách xưng hô, quan hệ và tính nhất quán giữa chương.
- Lưu và tải prompt tùy chỉnh `*.vi-VN.json` độc lập với `*.zh-CN.json`, `*.en-US.json`; không đè prompt cũ.
- Các nhãn nội dung cấu hình cố định (thể loại, đối tượng độc giả, kết cấu truyện, ngôi kể) có tên tiếng Việt. Giá trị do tác giả tự viết giữ nguyên.
- Dùng nguyên thuật toán `countDraftUnits()` phiên bản 3 để tránh phá vỡ các chương/bản nháp đã lưu; bộ đếm Unicode hiện đã coi mỗi từ tiếng Việt có dấu cách nhau bằng khoảng trắng là một đơn vị, đồng thời giữ quy tắc đếm chữ Hán và chữ số.

## Cần lưu ý

- Phiên bản này **chưa chứng minh mô hình AI nào cũng đáp ứng** độ dài 2.500 từ hoặc khả năng ghi nhớ truyện 500 chương. Kiểm thử thực tế với mô hình và dữ liệu truyện dài chưa tiến hành.
- Ở bước đầu, nhiều chỉ dẫn cấu trúc/JSON vốn viết bằng tiếng Anh được tái sử dụng nguyên vẹn và có lớp hướng dẫn viết tiếng Việt bổ sung. Chưa dịch trực tiếp từng câu của toàn bộ prompt hệ thống; mục đích là tránh làm sai schema.
- Việc nhập/xuất văn bản tiếng Việt phải được kiểm thử thực địa, đặc biệt với mẫu có tên riêng, nhân xưng, đại từ và từ Hán Việt.
- Chế độ ChatGPT tác giả qua MCP, checkpoint viết 10 chương và duyệt lô vẫn nằm ở Issue #3, không thuộc thay đổi này.

## Kiểm thử chấp nhận trước khi merge

1. Tạo dự án mới khi UI là tiếng Việt, lưu và mở lại, xác nhận `writingLanguage = vi-VN`.
2. Đổi ngôn ngữ giao diện của một dự án tiếng Anh và xác nhận ngôn ngữ sáng tác không bị đổi theo.
3. Chọn `vi-VN` trong cấu hình truyện, kiểm tra prompt chương đầu, chương tiếp, chỉnh sửa và review.
4. Kiểm tra các khóa JSON và placeholder không biến đổi, không có câu tiếng Anh ép mô hình viết tiếng Anh trong hợp đồng tiếng Việt.
5. Dữ liệu prompt tiếng Việt được lưu trong tên tệp riêng; mở lại vẫn đúng, không làm mất bản Trung/Anh.
6. Chương tiếng Việt có dấu và ký tự Unicode chuẩn hóa đều được đếm đúng; không tăng `DRAFT_UNIT_ALGORITHM_VERSION`.
7. Thử bản thảo thực tế với mô hình AI, đo số từ và kiểm tra mâu thuẫn nhân vật qua nhiều chương.
