# SSR Reader — Quyết định phân quyền Độc giả và Tác giả (18/10/2026)

Đây là **QUYẾT ĐỊNH SẢN PHẨM MỚI NHẤT**, ưu tiên hơn UX giai đoạn 3 dùng private key .pem thủ công.

## Đã chốt

1. Mục tiêu lâu dài **một ứng dụng, một tài khoản**: người dùng vừa đọc truyện công khai vừa có thể là tác giả với truyện của chính mình.
2. **Không có quyền sửa toàn bộ truyện chỉ vì người đó bật “Chế độ tác giả”.** Quyền quản trị cần kiểm tra theo mỗi tác phẩm: chủ sở hữu (owner_user_id) hoặc quyền cộng tác viên cụ thể được cấp hợp lệ.
3. Người khác đọc được **truyện đã công khai** và ghi chú/đánh dấu/lưu tiến độ cá nhân, không sửa chapter, lore, nhân vật, cảnh giới, hình/ảnh bìa, từ điển hoặc giới thiệu chính thức của tác giả.
4. Tác giả chỉnh sửa/duyệt hồ sơ/ảnh, mốc chương mở khóa và xuất bản truyện của mình. Ảnh từ điển có thể bỏ trống, tự tải hoặc tự tạo qua ChatGPT rồi chọn/duyệt.
5. Giai đoạn local **chưa cần màn hình đăng nhập hoặc file khóa .pem thủ công** trong UX đích. Mã 123 chỉ là ví dụ tính đơn giản, KHÔNG là mật khẩu/ủy quyền phù hợp khi app được phát hành.
6. Khi phát hành rộng, cần hệ thống đăng nhập và backend **xác minh quyền cho từng request**, không dựa vào UI client hoặc JSON tự khai chủ sở hữu.
7. Chống spoiler áp dụng cả text lẫn ảnh: chỉ thông tin ở các chương đã hoàn thành LIÊN TIẾP từ chương 1 được xem. Nhảy đến chương 100 không làm lộ phần ẩn.

## Mô hình logic đề xuất (CHƯA phải schema đã triển khai)

- User(id, auth_subject, display_name)
- Work(id, owner_user_id, visibility, revision, metadata)
- Chapter(id, work_id, ordinal, revision, visibility)
- EncyclopediaEntry(id, work_id, category, author_revision)
- EntryReveal(entry_id, gate_chapter, approved_description, optional_image_asset_id)
- Asset(id, work_id, created_by_user_id, storage_key, rights)
- ReaderState(user_id, work_id, position, bookmark, note, highlight, completed_chapters)
- WorkContributor(work_id, user_id, permission): tương lai, cần thiết kế riêng.

**Phân quyền phía backend:**

| Request | Quy tắc |
| --- | --- |
| GET truyện/chương/từ điển | public hoặc user có quyền xem, lọc theo spoiler/progress |
| PATCH/DELETE metadata/chương/ảnh/từ điển | session hợp lệ, work.owner_user_id == session.user_id (hoặc ủy quyền cụ thể) |
| POST xuất bản | chủ sở hữu được xác thực, revision đúng và lưu audit |
| PATCH ghi chú/tiến độ | chỉ dữ liệu của user đang đăng nhập |
| DELETE asset | chủ sở hữu đúng work, kiểm tra tham chiếu |

**Test bắt buộc khi làm auth:** user A cố sửa work B qua thay URL/bookId (IDOR), private draft bị truy cập từ user lạ, giả user_id client, token hết hạn, ảnh/ghi chú chéo, ngăn leak spoiler trong API/thumbnail/search.

## Giai đoạn local hiện tại khác với hướng đích

Stage 3 đã có hai ứng dụng portable: Reader read-only và Author Studio chọn khóa Ed25519 .pem để ký gói demo. **Không xóa bừa dữ liệu hoặc chữ ký cũ.** Cần thiết kế migration, làm đơn giản luồng tác giả local; có thể giữ kiểm tra chữ ký phát hành offline nếu hữu ích. Dùng UI “Tác phẩm của tôi” trong một app là hướng lâu dài đã đồng ý, nhưng hiện phải có cơ chế bảo vệ thực sự trước khi tuyên bố hỗ trợ nhiều người.

## Chưa quyết định

Provider login, backend/hosting, database server, lưu ảnh/CDN, chính sách chuyển quyền/coauthor, moderation, thanh toán/kiếm tiền, lịch triển khai và ngân sách. Không tự tạo dịch vụ Internet hoặc chia sẻ bản thảo nếu chưa được tác giả cho phép.
