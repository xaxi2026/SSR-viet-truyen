# SSR-viet truyen — Bàn giao tiếp tục phát triển

Cập nhật: 2026-10-10. Đây là tài liệu kỹ thuật để tiếp tục cùng ChatGPT ở máy khác/phiên khác, không phải tài liệu chứa dữ liệu riêng tư của người dùng.

## Repository và nhánh hiện tại

- Repo: https://github.com/xaxi2026/SSR-viet-truyen
- Nhánh tích hợp mới nhất (bao gồm toàn bộ thay đổi chưa merge của các PR xếp tầng): `feat/story-bridge-characters-v0`.
- Baseline trước tài liệu này: `9fc30c9d736430a5a9af58aac5de9df5ee699e6a`.
- Chuỗi Draft PR: #4 (Việt hóa UI) → #5 (ngôn ngữ sáng tác vi-VN) → #6 (Story Bridge config đề xuất) → #7 (duyệt cấu hình và lịch sử) → #8 (hồ sơ nhân vật v0).
- Không merge thẳng vào `master` khi chưa kiểm thử giao diện, review các thay đổi và xác minh không ảnh hưởng dữ liệu dự án.

## Máy và vị trí

- Máy phát triển gia đình: `nghia`, repo `D:\1-tool\7-SSR-viet-truyen`; dùng `corepack pnpm dev` từ thư mục repo.
- Có máy công ty đã kết nối Remote Desktop Commander, nhưng tại thời điểm kiểm tra 2026-10-10 chưa có lệnh `git` trên PATH (có Node.js). Không tự cài công cụ hoặc sao chép tệp cá nhân sang máy công ty; xin phép người dùng và tuân thủ chính sách IT trước.
- Repo GitHub chứa **mã nguồn**, không chứa dữ liệu truyện. Dự án truyện thử `test-1` ở vị trí **chỉ trên laptop** `D:\SSR-truyen test\test-1`. Không đẩy `.vela/vela.db`, nội dung truyện, bản nháp hoặc tệp dự án riêng lên GitHub công khai.
- Dùng đúng conversation hoặc chỉ rõ repo/nhánh/tài liệu này khi mở cuộc trò chuyện mới. ChatGPT không tự làm việc qua đêm nếu không có phiên làm việc đang chạy.

## Kết quả thực tế đã xác minh

- Giao diện Việt hóa và mode viết `vi-VN` hoạt động với bộ dự án thử.
- Story Bridge đọc SQLite `mode=ro`, tạo đề xuất riêng và xem/duyệt trên UI; một cấu hình truyện dài đã được người dùng áp dụng và lưu.
- Cơ chế review v1 xác nhận các trường đề xuất thực sự nằm trong SQLite trước khi đánh dấu đã chấp nhận; người dùng xác nhận UI hiển thị trong lịch sử với mã đề xuất.
- Kho nhân vật đã có **5 nhân vật** lưu chính thức từ đề xuất ChatGPT, revision đã tăng. Người dùng xác nhận thao tác trên UI.
- Story Bridge nhân vật v0 chỉ cho tối đa 12 hồ sơ, yêu cầu không trùng tên/revision và thêm vào bản nháp. **Chưa có vòng đời archive/reject/history cho đề xuất nhân vật**.
- Mỗi giai đoạn có unit test + lint/typecheck/i18n/build đã đạt trong lần kiểm tra trước, nhưng chưa chạy toàn bộ regression suite hay đóng gói installer.

## Milestone kế tiếp (triển khai LIỀN MẠCH, giảm dừng giữa các tính năng)

**Milestone Story Bridge v2 + Cấu trúc truyện**:

1. Hoàn thiện vòng đời `pending-characters.json`: xác nhận sau khi kiểm tra roster SQLite, từ chối, yêu cầu sửa, lịch sử, chống trùng/idempotence; thử bằng DB giả lập, không tác động vào nhân vật hiện có.
2. Mở rộng adapter cho Cấu trúc truyện — bốn mục: tiền đề, sơ đồ nhân vật, thế giới và tóm lược cốt truyện. Khảo sát schema/workflow hiện hành; sử dụng repository/IPC và kiểm tra project lease, không ghi thẳng DB từ bridge. Cần tách bạch cấu trúc truyện và danh sách nhân vật (không tạo đúp).
3. Thiết kế proposal có schema/version/baseline revision; hiển thị diff và nút nạp vào bản nháp; yêu cầu tác giả duyệt trước lưu; lưu lịch sử.
4. Soạn nội dung ban đầu cho truyện thử dựa trên canon đã lưu, không tự ý bịa dữ kiện trái hồ sơ chính thức.
5. Việt hóa nhãn/tooltip/thông báo của các màn hình này; kiểm thử TS + Python + Vitest, tích hợp, sau đó thử UI thật, mở một Draft PR stacked.
6. Chỉ sau khi v2 ổn mới mở luồng dàn ý nhiều chương và viết chương với checkpoint/continuity.

Bảo vệ dữ liệu: không tự viết đè chương hoặc nhân vật đã duyệt, không merge PR ngoài ý muốn, không công khai dữ liệu truyện; có backup trước migrations nếu thật sự cần. Tránh tự động hóa các hành động làm thay đổi dữ liệu chính thức nếu chưa được người dùng cho phép.

## Lệnh khôi phục trên máy đã có repo

```powershell
cd "D:\1-tool\7-SSR-viet-truyen"
git fetch origin
git switch feat/story-bridge-characters-v0
git pull --ff-only
corepack pnpm install
corepack pnpm dev
```

Trên máy mới, chọn thư mục làm việc thích hợp; nếu có Git thì clone và checkout nhánh `feat/story-bridge-characters-v0`; cần Node.js, Corepack/pnpm và các dependency theo package.json. Không clone vào đường dẫn làm việc hiện có nếu chưa kiểm tra.

## Câu lệnh dùng trong ChatGPT ngày mai

> Tiếp tục dự án SSR-viet truyen theo `docs/DEV_HANDOFF.md` trên nhánh `feat/story-bridge-characters-v0`. Hãy kiểm tra GitHub và máy được kết nối, sau đó triển khai trọn milestone Story Bridge v2 + Cấu trúc truyện trong một lượt làm việc; đừng dừng sau mỗi tính năng nhỏ. Chạy kiểm thử, tạo Draft PR, không tự sửa dữ liệu truyện đã duyệt. Thông báo chỉ khi có blocker hoặc cần tôi kiểm tra GUI.

