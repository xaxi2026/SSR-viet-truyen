# SSR Story Bridge — Dàn ý theo đợt (v3 thử nghiệm)

## Lý do có luồng độc lập

SSR có hệ thống sinh `project_core.synopsis` và `.vela/partial_arch.json` của AI nội bộ, có kiểm soát dấu vân tay dữ kiện, checkpoint, chương đã bao phủ và tiếp tục sau gián đoạn. **Không ghi trực tiếp vào hai nguồn này từ ChatGPT**, vì sẽ khiến checkpoint lệch hoặc âm thầm ghi đè dàn ý do tác giả đã lưu.

Luồng v3 chỉ là **dàn ý kế hoạch riêng đang chờ duyệt**, không phải chương hoàn chỉnh và không phải bản `synopsis` chính thức. Mỗi đợt tối đa 10 chương, để người dùng duyệt nội dung trước khi lập kế hoạch đợt kế tiếp.

## Quy trình

1. Duyệt **Tiền đề** và **Xây dựng thế giới** của truyện bằng Story Bridge v2 trước. Các mục này phải lưu vào SQLite.
2. ChatGPT chạy `python scripts/ssr_outline_bridge.py inspect --project "D:\\...\\test-1"`; đọc baseline, `rosterRevision`, `rosterFactHash`, `coveredTo` và `previousAcceptedId`.
3. Nếu tiếp tục, có thể đọc mười chương gần nhất đã duyệt bằng `python scripts/ssr_outline_bridge.py read-approved --project "D:\\...\\test-1" --last 10`.
4. ChatGPT soạn JSON tối đa 10 chương, đúng dải `nextFrom`, trường bắt buộc `chapter, title, summary, conflict, hook, continuity`. `summary` tối thiểu 60 ký tự. Không bịa chương ngoài dải.
5. Gửi bản chờ: `python scripts/ssr_outline_bridge.py propose --project "D:\\...\\test-1" --input "D:\\outline-draft.json"`.
6. Trong SSR: **Cấu trúc truyện → Dàn ý ChatGPT → Kiểm tra đề xuất**. Người dùng xem từng chương, chọn **Duyệt đợt**, **Từ chối** hoặc **Yêu cầu sửa**.
7. Khi duyệt, main process kiểm tra context dự án, snapshot nguồn hiện tại và chuỗi các đợt đã duyệt; chỉ lưu `history/outline/<UUID>.json` độc quyền + fsync, rồi dọn `pending-outline-batch.json`. Không ghi SQLite, không tự tạo chương và không động đến `partial_arch.json`.
8. Nếu tác giả đổi tiền đề, thế giới, core outline, hướng dẫn toàn cục, tổng số chương, ngôn ngữ hoặc revision/hash nhân vật sau khi duyệt đợt trước, **dừng nối đợt mới**. Cần rà soát lại chuỗi đã duyệt và bổ sung cơ chế revision chính thức, không tự sửa lịch sử.
9. Mỗi batch nối đúng `coveredTo + 1` và gắn `previousAcceptedId`, cấm trùng/chồng/gap. Bản đã từ chối không tính tiến độ. Lịch sử vẫn giữ nội dung và lý do.

Ví dụ đầu vào:

```json
{
  "projectId": "project-id-cua-ban",
  "from": 1,
  "to": 2,
  "note": "Chỉ là đề xuất chờ duyệt",
  "chapters": [
    {
      "chapter": 1,
      "title": "Mở đầu",
      "summary": "Mô tả cụ thể diễn biến, mâu thuẫn, bằng chứng, lựa chọn và hệ quả trong chương, đủ 60 ký tự.",
      "conflict": "Điểm đối kháng",
      "hook": "Câu hỏi hoặc hệ quả nối chương sau",
      "continuity": "Địa điểm, thời gian, trạng thái nhân vật và vật chứng chưa công khai"
    },
    {
      "chapter": 2,
      "title": "Phát hiện",
      "summary": "Mô tả cụ thể diễn biến, mâu thuẫn, bằng chứng, lựa chọn và hệ quả chương thứ hai, đủ 60 ký tự.",
      "conflict": "Lựa chọn có hậu quả",
      "hook": "Manh mối nối phần tiếp theo",
      "continuity": "Giữ nguyên tên và cảnh giới đã duyệt"
    }
  ]
}
```

## Trạng thái test-1 trên laptop nhà

Đường dẫn dữ liệu riêng: `D:\SSR-truyen test\test-1`. Tại thời điểm triển khai, `premise` và `worldbuilding` trong SQLite **vẫn trống**; đề xuất từ v2 đang chờ duyệt. Vì vậy CLI chưa cho phép tạo pending outline chính thức.

Đã soạn **bản nháp 1–10** nằm **ngoài GitHub** tại `D:\1-tool\ssr-test1-outline-001-010-draft.json`. Sau khi người dùng duyệt tiền đề/thế giới, ChatGPT cần đối chiếu bản nháp với canonical facts mới rồi mới stage; không nhận nháp là dữ liệu đã duyệt.

## Kiểm thử và giới hạn

- Kiểm tra đúng 10 chương, từng chương có mục tiêu xung đột và điểm nối; chặn trùng, thiếu, lệch số, dải hơn 10 chương, project sai.
- Chặn nguồn dữ kiện thay đổi khi xét duyệt hoặc giữa các đợt.
- Biên nhận review chống ghi đè; idempotent sau trường hợp đã archive nhưng chưa dọn pending.
- Chưa có luồng chuyển các batch đã duyệt sang `project_core.synopsis` / `partial_arch.json`. Cần thiết kế bridge riêng có thể tái tạo checkpoint nhất quán và bằng chứng provenance trước khi tích hợp, không dùng `db:project-core-update` tùy tiện.
- Cần thử GUI Electron thật trên Windows trước khi merge. Chưa triển khai tự viết hàng trăm chương qua đêm.

## Chế độ duyệt một lần theo quyển (100 chương)

**Dùng khi tác giả chủ động yêu cầu gộp công việc trong một quyển.** Ví dụ đã duyệt 1–20, sẽ chuẩn bị bản 21–100 và cho tác giả duyệt **80 chương trong một lần**. Đây chỉ là dàn ý kế hoạch; không tạo ra 80 chương văn xuôi hay nhập vào `project_core.synopsis`.

```powershell
# Trên máy được phép làm việc, sau khi đã viết và kiểm tra JSON 21–100
python scripts/ssr_outline_bridge.py propose-volume --project "D:\\SSR-truyen test\\test-1" --input "D:\\1-tool\\ssr-test1-outline-021-100-volume-draft.json" --supersede-pending
```

- `propose` cũ vẫn **giới hạn 10 chương**. `propose-volume` cho phép tối đa 100, phải kết thúc tại ranh giới quyển 100/200/... (hoặc chương cuối tác phẩm).
- Chế độ `--supersede-pending` chỉ được phép khi bản chờ cũ (vd. 21–30) trùng chính xác **toàn bộ chương đầu** của gói mới, dự án và snapshot canon trùng, và vẫn là pending. Bản cũ được lưu nguyên trong lịch sử với trạng thái `revision_requested` và lý do gộp theo yêu cầu của tác giả; không xóa lặng lẽ.
- Đọc trong ứng dụng qua **Cấu trúc truyện → Dàn ý ChatGPT → Kiểm tra đề xuất**; khi có hơn 10 chương, giao diện hiển thị các trang 10 chương. Chỉ **một lần duyệt** sẽ thêm cả gói vào lịch sử duyệt; nếu từ chối hoặc yêu cầu sửa thì cả gói vẫn chưa được công nhận.
- Khi duyệt, main process vẫn xác minh phiên dự án, ID, baseline canon, thứ tự, nguồn dữ kiện đã được duyệt trước và `previousAcceptedId`. Không có bất kỳ thao tác nào ghi SQLite hoặc checkpoint `partial_arch.json` do duyệt gói.
- Gói đang chờ không tự chạy qua đêm, không tự được duyệt, không thể thay chương văn xuôi đã viết.

### Trạng thái thử nghiệm riêng trên laptop nhà

Dữ liệu thử `test-1` và các bản nháp JSON chỉ được lưu trên laptop nhà `nghia`. Mã nguồn trên GitHub **không chứa nội dung truyện**. Khi cần đồng bộ máy công ty, phải có yêu cầu riêng của tác giả. Không tự copy truyện hay file .vela sang đó.
