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
git switch feat/story-bridge-v2-architecture
git pull --ff-only
corepack pnpm install
corepack pnpm dev
```

Trên máy mới, chọn thư mục làm việc thích hợp; nếu có Git thì clone và checkout nhánh `feat/story-bridge-characters-v0`; cần Node.js, Corepack/pnpm và các dependency theo package.json. Không clone vào đường dẫn làm việc hiện có nếu chưa kiểm tra.

## Câu lệnh dùng trong ChatGPT ngày mai

> Tiếp tục dự án SSR-viet truyen theo `docs/DEV_HANDOFF.md` trên nhánh `feat/story-bridge-characters-v0`. Hãy kiểm tra GitHub và máy được kết nối, xác minh Story Bridge v2, sau đó tiếp tục lập dàn ý 500 chương theo từng nhóm và triển khai các checkpoint; đừng dừng sau mỗi tính năng nhỏ. Chạy kiểm thử, tạo Draft PR, không tự sửa dữ liệu truyện đã duyệt. Thông báo chỉ khi có blocker hoặc cần tôi kiểm tra GUI.


## Cập nhật mới nhất — Story Bridge v2 (2026-10-10)

- Đã triển khai đề xuất/duyệt/lịch sử nhân vật với điều kiện toàn bộ hồ sơ đúng như đã lưu trong SQLite, sửa hoặc từ chối có phản hồi.
- Đã triển khai \`inspect-architecture\` và \`propose-architecture\` trong CLI; tại UI Cấu trúc truyện có đề xuất, xem khác biệt, Chấp nhận và lưu, Từ chối, Yêu cầu sửa và lịch sử. Chỉ nhận \`premise\`, \`worldbuilding\`, \`synopsis\`; không viết trực tiếp bản chiếu \`charactersArch\`.
- Duyệt cấu trúc thực hiện giao dịch SQLite có điều kiện (CAS), không ghi đè nếu dữ liệu nền đã thay đổi. Bản đang sửa chưa lưu trong tab được chặn.
- Đã tạo đề xuất \`premise\` và \`worldbuilding\` cho \`test-1\`, ở trạng thái pending riêng trên máy nhà. Không tự apply.
- Hướng dẫn cài ở máy công ty: \`docs/COMPANY_SETUP_VI.md\`.
- Hướng dẫn kỹ thuật v2: \`docs/SSR_STORY_BRIDGE_V2.md\`.
- Việc tiếp theo: kiểm thử giao diện Electron trực tiếp, hoàn thiện dàn ý theo từng nhóm chương, vận hành checkpoint truyện dài; không tự tuyên bố toàn bộ 500 chương đã được lập kế hoạch.

## Kiểm thử hồi quy mở rộng (2026-10-10)

- Đã chạy full `vitest run` trên laptop; phần lớn bài test được ghi nhận thành công nhưng lượt chạy không kết thúc đúng hạn. Log riêng trên máy nhà: `D:\1-tool\ssr_v2_full_suite.log`.
- Một nhóm test nhập tài liệu 7/10 thất bại khi chạy chung vì `mainText` đọc ngôn ngữ UI đã lưu của laptop, khác locale mock `zh-CN` trong test. Đã sửa **chỉ trong test** để cô lập locale; chạy lại nhóm này 10/10 PASS.
- V2 chuyên biệt: 18/18 Vitest, 8/8 Python, TypeScript, lint, i18n, build PASS. Khi làm tiếp, chạy full suite bằng worker limit hợp lý và ghi nhận các lỗi khác nếu có.
- Không coi full regression PASS trước khi có kết quả cuối đầy đủ.

## Tiến độ mới — Dàn ý theo đợt trên laptop nhà

- Branch mới `feat/story-bridge-outline-batches` (stacked trên `feat/story-bridge-v2-architecture`).
- Bộ nhận dàn ý 10 chương/lần độc lập với checkpoint sinh `synopsis` nội bộ. CLI `scripts/ssr_outline_bridge.py`: `inspect`, `propose`, `read-approved`.
- Electron UI: Cấu trúc truyện → **Dàn ý ChatGPT**, xem/duyệt/từ chối/yêu cầu sửa/lịch sử; main process kiểm tra projectId, nguồn dữ kiện, roster revision/hash, chuỗi đợt không bị đứt hay lặp.
- Tài liệu kỹ thuật: `docs/SSR_STORY_BRIDGE_OUTLINE_BATCHES.md`.
- Laptop nhà có bản nháp nội dung chương 1–10 `D:\1-tool\ssr-test1-outline-001-010-draft.json`, **không đưa lên GitHub**, chưa stage do Tiền đề và Xây dựng thế giới trong SQLite còn trống. User cần duyệt đề xuất v2 trước.
- GitHub phía công ty đã có `.gitignore` không theo dõi `/SSR-truyen/`. Không đưa dữ liệu test-1 trong cả hai máy lên repo.
