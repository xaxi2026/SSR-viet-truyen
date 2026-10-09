# SSR Story Bridge v0 — ChatGPT → SSR-viet truyen (bản thử nghiệm)

## Mục tiêu

ChatGPT qua Remote Desktop Commander có thể **đọc cấu hình đã lưu** trong dự án và gửi **đề xuất nội dung**, sau đó người dùng mở trang Cấu hình truyện và quyết định có áp dụng hay không. Đây chưa phải MCP Server hay AI chạy tự động trong nền.

**Chưa có bất kỳ công cụ nào cho phép ChatGPT ghi trực tiếp vào SQLite hoặc duyệt chương.**

## Kiến trúc và ranh giới an toàn

- Bridge CLI: `scripts/ssr_story_bridge.py` (Python 3 + SQLite chuẩn), kết nối SQLite chế độ `mode=ro` / `query_only`; đọc duy nhất bản ghi `project_core`.
- Phân biệt **cấu hình đã lưu trên đĩa** với **cấu hình đang chỉnh sửa trên giao diện**.
- Kiểm tra manifest `.vela/project.json` (`kind=ai-novel-project`, `projectId`).
- Đề xuất được lưu riêng tại `.vela/story-bridge/pending-config.json`, không chỉnh `vela.db`, `project.json`, chương hoặc hồ sơ nhân vật.
- CLI dùng chế độ tạo tệp mới độc quyền (`x`); từ chối ghi đè một đề xuất chưa xử lý.
- UI đọc bằng `fs:read-json` có bảo vệ phiên dự án; kiểm tra `projectId`, loại trường được phép và ảnh chụp dữ liệu gốc.
- Nếu có thay đổi chưa lưu hoặc cấu hình đã thay đổi kể từ lúc ChatGPT đọc, UI **chặn áp dụng**. Cấu hình đang khác snapshot cần được lưu và tạo đề xuất lại.
- Người dùng cần bấm **Áp dụng vào biểu mẫu** để nạp; sau đó vẫn có thể chỉnh và bấm **Lưu** bằng tay. Quy trình này không tự duyệt hay định稿.

## Thử đọc dự án

```powershell
python scripts/ssr_story_bridge.py inspect --project "D:\duong-dan\du-an-truyen"
```

Output là JSON gồm `projectId`, `projectName`, `persistedAt`, `config`. **Không nên đăng dữ liệu riêng tư lên repository công khai.**

## Tạo đề xuất

Soạn JSON bên ngoài thư mục dự án:

```json
{
  "projectId": "<projectId từ inspect>",
  "changes": {
    "coreOutline": "Tóm tắt ý tưởng truyện mà tác giả đã đưa.",
    "worldSetting": "Bối cảnh đề xuất từ ý tưởng đó.",
    "protagonistProfile": "Nhân vật chính theo mô tả của tác giả."
  },
  "note": "Đây là bản đề xuất thử nghiệm, chưa được duyệt."
}
```

```powershell
python scripts/ssr_story_bridge.py propose --project "D:\duong-dan\du-an-truyen" --input "D:\duong-dan\de-xuat.json"
```

Hiện chỉ hỗ trợ các trường nội dung tự do: `subGenre`, `coreOutline`, `worldSetting`, `goldenFinger`, `protagonistProfile`, `globalGuidance`, `writingStyle`, `referenceWorks`. Không cho đổi ngôn ngữ, thể loại chuẩn, đối tượng độc giả, số chương hoặc số từ bằng cầu nối.

## Nhận đề xuất trong giao diện

1. Mở đúng dự án và trang **Cấu hình truyện**.
2. Nhấn **Đề xuất từ ChatGPT** → **Đọc đề xuất mới**.
3. So sánh các trường **Hiện tại / Đề xuất mới**.
4. Chỉ khi nhận diện đúng dự án và dữ liệu gốc còn khớp, bấm **Áp dụng vào biểu mẫu để tôi kiểm tra**.
5. Đọc lại nội dung, tự chỉnh và nhấn **Lưu** nếu đồng ý.

Một dự án chỉ có một `pending-config.json` ở bản đầu. Tệp được giữ nguyên để phục vụ rà soát và hiện chưa có UI thu hồi/xóa đề xuất. Không được tạo đề xuất mới bằng cách ghi đè khi chưa xử lý bản cũ.

## Kiểm thử

```powershell
python scripts/test_story_bridge.py
corepack pnpm exec vitest run src/shared/__tests__/story-bridge-proposal.test.ts
corepack pnpm run typecheck
corepack pnpm run lint
corepack pnpm run check:i18n
corepack pnpm run build
```

## Chưa hỗ trợ

- Chưa có chế độ tự chọn mô hình, ChatGPT API, MCP Server từ xa hoặc tunnel.
- Chưa có webhook/streaming, hệ thống tự viết hàng loạt, checkpoint chương hay lưu tự động hàng trăm chương.
- Chưa có thử nghiệm đầu-cuối có người tương tác màn hình Windows. Cần chạy thử giao diện trước khi merge.
