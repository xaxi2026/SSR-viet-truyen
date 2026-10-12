# SSR-viet-truyen — Quy trình chuẩn cho ChatGPT khi bắt đầu truyện mới

**Phạm vi:** Hướng dẫn thực hiện trong **cuộc trò chuyện ChatGPT mới**, qua repository và ứng dụng desktop. Đây là quy trình cho tác phẩm bất kỳ, **không phải** tiến độ hoặc dữ liệu của `test-1`. Không phải một agent tự chạy nền, một MCP server đang triển khai hay lời hứa phần mềm viết xong 500 chương.

**Đọc đầu tiên:** [../CHATGPT_START_HERE.md](../CHATGPT_START_HERE.md) → [../AGENTS.md](../AGENTS.md) → tài liệu này. Với bước chuyên sâu chỉ đọc tài liệu tương ứng và **kiểm chứng lại code ở branch/SHA thực tế**.

## 1. Nhận diện nguồn dữ liệu và quyền

| Nơi lưu | Có gì | Quy tắc |
| --- | --- | --- |
| GitHub `xaxi2026/SSR-viet-truyen` | Code, tài liệu, test, quy trình | Có thể nghiên cứu; không chứa nội dung riêng của từng truyện |
| Dự án truyện trong ứng dụng | `.vela/project.json`, SQLite, chương, lịch sử duyệt, đề xuất | Chỉ đọc/ghi sau khi được người dùng chọn đúng máy, đúng thư mục, đúng thao tác |
| Cuộc trò chuyện ChatGPT | Ý tưởng đang thảo luận, bản đề xuất chưa lưu | Không coi là checkpoint hoặc nguồn dữ kiện vĩnh viễn |
| LocalStorage của Reader | Vị trí đọc, đánh dấu, tùy chỉnh trên từng máy | Không đồng bộ tiến độ giữa các máy hay chứa chương truyện |

- Cuộc chat mới phải xác minh **repo, branch, commit, công cụ hiện có, thiết bị được phép, thư mục tác phẩm và tình trạng dự án**. Không suy đoán rằng đã có quyền truy cập máy, đã đọc file hoặc đã tạo dự án.
- Không có plugin GitHub/Remote Desktop Commander hoặc không truy cập được: trình bày rõ hạn chế, xin người dùng kết nối/cung cấp phần liên quan; vẫn có thể **lên ý tưởng và soạn đề xuất ngay trong chat** nhưng không nhận là đã lưu lên máy.
- Không tự truy cập máy công ty, thiết bị khác, cloud, thư mục truyện cũ hoặc bất kỳ nguồn dữ liệu riêng tư nào ngoài phạm vi được chỉ định.
- **Không bao giờ copy `.vela` hay DB của tác phẩm khác** để tạo truyện mới. Dự án mới phải dùng thao tác tạo dự án chuẩn.
- Mã nguồn GitHub và dữ liệu truyện là độc lập; không commit nội dung truyện riêng, thông tin nhân vật riêng, khóa API, SQLite, ZIP backup, log/screenshot chứa nội dung cá nhân.
- Thay đổi code: branch riêng/PR chưa merge cho tới khi tác giả yêu cầu. Bắt đầu truyện không tự nó cho phép merge, deploy, cập nhật máy khác.

## 2. Cách phản hồi đầu tiên trong chat mới

Nếu người dùng nói “Tạo truyện mới”, “bắt đầu một bộ khác” hoặc tương tự:

1. Nhận diện đây là **truyện mới**, không tiếp nối truyện đã có; nêu rõ ChatGPT sẽ đi từ ý tưởng → cấu hình → cốt truyện/nhân vật → dàn ý → bản nháp → duyệt.
2. Xác minh khả năng đọc repository qua GitHub; nếu được phép làm trên máy thì kiểm tra máy đúng và code phiên bản đang chạy. Đừng truy vấn truyện cũ không liên quan.
3. Hỏi tác giả về **ý tưởng cốt lõi hoặc thể loại muốn viết** trước. Nếu tác giả chưa nghĩ ra, đề xuất 2–3 ý tưởng khác nhau để chọn. Không dùng biểu mẫu dài hoặc yêu cầu tất cả thông số ngay.
4. Khi ý tưởng đã rõ, trao đổi từng bước để xác lập **tên truyện, thể loại/phong cách, bối cảnh, nhân vật chính, mâu thuẫn chính, ngôi kể, độ dài dự kiến (số chương và đơn vị từ/chương), định hướng kết truyện**. Chưa có câu trả lời thì giữ trạng thái **chưa quyết định**; không biến giá trị gợi ý thành canon.
5. Tóm tắt một trang **Creative Brief** để người dùng sửa/duyệt. **Chưa tạo dự án, chưa sinh hàng trăm dàn ý, chưa viết chương 1** khi tác giả chưa yêu cầu.

Câu mở đầu gợi ý: “Mình sẽ xây dựng truyện mới độc lập. Bạn muốn viết theo ý tưởng/thể loại nào? Nếu chưa có, mình có thể gợi ý vài hướng để bạn chọn.”

## 3. Trình tự làm một truyện mới

| Giai đoạn | ChatGPT chuẩn bị | Tác giả quyết định | Dấu hiệu hoàn tất |
| --- | --- | --- | --- |
| **A — Ý tưởng** | Brief, điểm mới, thể loại, độ dài gợi ý | Duyệt brief và mục tiêu | Ý tưởng được tác giả xác nhận |
| **B — Dự án** | Kiểm tra app/version, gợi ý nơi lưu mới, tên thư mục | Chọn máy, tên, vị trí, đồng ý tạo | Tạo **dự án trống** qua SSR, project ID mới |
| **C — Cấu hình** | Đề xuất ngôn ngữ sáng tác, hướng dẫn giọng văn, số chương, số từ, luật tác phẩm | Sửa, Lưu, xác nhận | Cấu hình thực tế đọc lại khớp |
| **D — Kiến trúc** | Tiền đề, thế giới, quy luật và tuyến truyện, hồ sơ nhân vật | Duyệt/từ chối/yêu cầu sửa | Dữ kiện đã duyệt được lưu bởi app |
| **E — Dàn ý** | Quyển/arc, điểm ngoặt, dàn ý chương theo từng đợt | Duyệt từng đợt hoặc quyển | Lịch sử dàn ý được xác minh, chưa phải văn xuôi |
| **F — Bản nháp** | Blueprint đúng chương, viết cảnh/chương theo số từ đã thống nhất, soát mâu thuẫn | Đọc và yêu cầu sửa | Lưu **draft** qua đường hỗ trợ của SSR |
| **G — Chính thức** | Trình bản cuối kèm kiểm tra độ dài, logic, continuity | **Tự tay duyệt/chốt** | Chương finalized/published được xác minh |
| **H — Tiếp tục** | Đọc trạng thái thực, chương cuối, canon, chương đã duyệt và checkpoint | Cho phép viết chương/đợt tiếp theo | Không lặp chương, không mất phần đã lưu |

**Gating:** Đừng tự đi qua ranh giới phê duyệt của tác giả. Mọi bước có thể báo “ĐANG ĐỀ XUẤT”, “CHỜ DUYỆT”, “ĐÃ LƯU”, “ĐÃ CHỐT”, “BỊ CHẶN” với bằng chứng cụ thể. Người dùng có thể chủ động yêu cầu lập kế hoạch dài hơn nhưng điều đó không cho quyền tự chốt.

### B — Tạo dự án đúng cách

- Màn hình hiện có là **New novel project / Tạo dự án truyện mới**, nhập *Title* và *Save location*; thể loại và các tùy chỉnh còn lại thiết lập **bên trong Cấu hình truyện**. `src/components/dialogs/NewProjectDialog.tsx` gọi `useProjectStore.createProject` → Electron `project:create`. Không có lý do viết SQLite thủ công.
- Xác nhận người dùng chọn **thư mục cha mới** (ví dụ `D:\TruyenMoi`) và tên tác phẩm. SSR sẽ tạo thư mục dự án của chính nó; kiểm tra path được trả về trước khi công bố thành công. Không mặc định tên thư mục, không ghi đè hoặc đổi tên dự án khác.
- Giao diện tiếng Việt thường chuyển `writingLanguage=vi-VN` vào cấu hình tạo dự án. **Đọc lại giá trị đã lưu** trong app thay vì suy đoán theo UI; nếu khác `vi-VN` phải xin phép sửa có kiểm soát. `uiLocale` khác với `writingLanguage`.
- Kiểm tra đúng `projectId`, `projectPath`, cơ sở dữ liệu truy cập được, `PRAGMA integrity_check=ok` nếu có công cụ đọc an toàn. Đừng công khai project ID/đường dẫn riêng trong PR.
- Sau khi tạo có thể thử **Backup** vào vị trí người dùng chọn. Sao lưu/Restore là dự án riêng và không đồng nghĩa đã đồng bộ giữa hai máy.

### C — Cấu hình và Story Bridge

- Với dự án đã tạo, nếu cần đọc cấu hình **đã lưu**, dùng `python scripts/ssr_story_bridge.py inspect --project "<PROJECT_PATH>"` qua công cụ được cấp quyền. Đây là **read-only**.
- Đề xuất qua `ssr_story_bridge.py propose` là **pending-config** riêng, không tự đổi SQLite. Chi tiết JSON và UI duyệt: [SSR_STORY_BRIDGE_V0.md](SSR_STORY_BRIDGE_V0.md), [SSR_STORY_BRIDGE_V1.md](SSR_STORY_BRIDGE_V1.md).
- Màn hình **Cấu hình truyện → Đề xuất từ ChatGPT** cho tác giả xem trước, áp dụng vào biểu mẫu, chỉnh và bấm **Lưu**; “xác nhận đã lưu” chỉ khi nội dung khớp thực tế. Một pending còn tồn tại thì không được ghi đè.
- Các giá trị như tổng chương/số từ, ngôn ngữ và nhãn chọn sẵn có thể cần thao tác GUI trực tiếp; **CLI đề xuất v0 không được phép sửa những trường này**.
- Không biến đề xuất thành sự thật nếu người dùng chỉ nói “xem thử”.

### D — Nhân vật, thế giới, kiến trúc

- Dữ kiện tác giả đã duyệt luôn ưu tiên hơn suy luận của ChatGPT; trạng thái nhân vật phải có bằng chứng và revision.
- Kiểm tra cấu trúc bằng `ssr_story_bridge.py inspect-architecture`; chỉ đưa `premise`, `worldbuilding`, `synopsis` vào đề xuất phù hợp với [SSR_STORY_BRIDGE_V2.md](SSR_STORY_BRIDGE_V2.md). Tác giả **Chấp nhận và lưu** trên GUI mới ghi canonical.
- Nhân vật sử dụng luồng roster/đề xuất của Story Bridge, không ghi trực tiếp tệp chiếu `characters.md` như nguồn sự thật độc lập.
- Nếu tác giả sửa luật thế giới hoặc nhân vật, kiểm tra ảnh hưởng lên dàn ý/bản nháp đã duyệt trước khi tiếp tục.

### E — Dàn ý dài, nhưng không nhầm với chương

- Chọn cấu trúc theo nhu cầu: tổng chương có thể là vài chục hay hàng trăm; **500 chương không phải mặc định** cho mọi truyện.
- Viết dàn ý theo đợt, tránh tạo hàng trăm chương thiếu nhất quán trong một phản hồi. Lệnh `ssr_outline_bridge.py inspect` và `read-approved` dùng để biết đợt đã duyệt khi có công cụ và project đúng.
- Theo [SSR_STORY_BRIDGE_OUTLINE_BATCHES.md](SSR_STORY_BRIDGE_OUTLINE_BATCHES.md): `propose` tối đa 10 chương/đợt; `propose-volume` tối đa 100 chương và chỉ khi điều kiện ranh giới quyển cùng quyền tác giả thỏa. Dùng GUI **Cấu trúc truyện → Dàn ý ChatGPT → Kiểm tra đề xuất** để duyệt.
- **Dàn ý đã duyệt trong Story Bridge chưa tự động trở thành blueprint trong SQLite.** Có công cụ pilot/import theo [SSR_PROSE_CHAPTER_PILOT.md](SSR_PROSE_CHAPTER_PILOT.md), với preflight, phiên bản và quy tắc không ghi đè; không coi tất cả workflow bulk đã hoàn tất.
- Mỗi mục dàn ý gồm động cơ, xung đột, sự kiện, hệ quả, continuity và hook; giữ nguyên dữ kiện đã duyệt.

### F–G — Viết, soát và duyệt chương

- Chỉ bắt đầu viết chương thực sau khi tác giả phê duyệt **số chương, dàn ý/blueprint nguồn và mục tiêu độ dài**. Nếu không có yêu cầu viết, dừng ở trạng thái kế hoạch.
- Trước mỗi chương đọc lại canon, ending chương trước, roster, luật thế giới, timeline, dangling hooks, nguồn blueprint và dự thảo trước (có nhãn *candidate*). Không bịa tình tiết đã xảy ra hoặc cố định nhân vật chưa được duyệt.
- Soạn chương thành những cảnh quản lý được; đánh giá tiếng Việt tự nhiên, nhân xưng, logic hành động, continuity, số từ và kết thúc chương. Đếm theo phép đo app, không đồng nhất từ với token.
- Lưu nháp qua luồng **DraftRepository / UI/bridge được hỗ trợ**, với biên nhận và kiểm tra danh tính. Nếu chỉ có `ssr_chatgpt_batch.py` staging thì **chỉ là candidate ngoài native DraftRepository** — không tuyên bố đã nhập chương. Xem [CHATGPT_WORKSPACE_FOUNDATIONS.md](CHATGPT_WORKSPACE_FOUNDATIONS.md) và [CHATGPT_BATCH_WRITING_SPEC.md](CHATGPT_BATCH_WRITING_SPEC.md).
- **Không chỉnh SQL trực tiếp** để thêm chapter/blueprint/finalization; không tự bấm duyệt thay tác giả; không tự chạy một lô dài nếu chưa được yêu cầu.
- Với `vi-VN`, một số hậu xử lý ghi chú/nhân vật từ ChatGPT còn chờ chức năng native hoàn thiện. Không hứa AI tự ghi canon nhân vật sau chốt nếu chưa có receipt đúng.

### H — Tiếp tục ở chat khác, đổi máy và khôi phục

Khi người dùng nói “Tiếp tục truyện <tên>”:

1. Yêu cầu/chọn **đúng thư mục dự án được phép**, không mặc định `test-1` hay thư mục “mới nhất” chỉ từ lịch sử chat.
2. Dùng công cụ đọc trạng thái thực trên máy (project ID, ngôn ngữ, revision canon, dàn ý accepted, blueprint, chương draft/finalized, pending proposal/checkpoint). **Không giả định** một chương đã hoàn thành chỉ vì một chat trước từng nói vậy.
3. Nếu có chênh lệch giữa thông tin chat, GitHub và SQLite/app: **app + lịch sử duyệt của tác giả là nguồn chính**, hỏi trước khi sửa.
4. Phân biệt `accepted outline`, `native blueprint`, `draft candidate`, `finalized/published`. Đừng viết trùng hay cố “tiếp tục” dựa trên bản tóm tắt cũ.
5. Ghi biên bản ngắn sau mỗi phiên: **tên truyện (không công khai), project path riêng, trạng thái đã kiểm chứng, bước chưa duyệt và việc tiếp theo**. Lưu biên bản **cục bộ bên ngoài GitHub** nếu có ủy quyền; trong chat mới vẫn phải kiểm tra lại.
6. Sao lưu project bằng SSR ZIP để chuyển máy; **GitHub cập nhật code không đồng bộ dữ liệu truyện**. Sao lưu/Restore mặc định tạo thư mục mới, không ghi đè. Chỉ khôi phục/chuyển máy khi người dùng cho phép; không xử lý đồng bộ hai bản đang cùng chỉnh như thể có cơ chế merge.
7. Vị trí đọc/bookmark trên Reader hiện theo **thiết bị**, không theo ZIP/GitHub, trừ khi phát triển đồng bộ được kiểm chứng.

## 4. Ma trận quyền và điểm dừng

| Hoạt động | Không cần duyệt nội dung | Cần xác nhận cụ thể |
| --- | --- | --- |
| Đọc repository công khai, giải thích quy trình | Có | Không được nhận đã đọc nếu công cụ không truy cập được |
| Đề xuất ý tưởng, viết brief/outline ngay trong chat | Có | Chưa lưu hoặc xác nhận canon |
| Đọc dữ liệu riêng trên máy | Không | Người dùng chỉ định máy và dự án/quyền đọc |
| Tạo thư mục và project mới | Không | Tên, thư mục cha, máy được phép |
| Stage đề xuất config/architecture/outline | Không mặc nhiên | Đúng project, chấp thuận tạo pending; tránh overwrite |
| Áp dụng/sửa canon, nhân vật, dàn ý, blueprint | Không | Tác giả duyệt qua GUI/giao thức hợp lệ |
| Lưu draft/nhập bản thảo | Không mặc nhiên | Đúng chương, project, nội dung và đường import hợp lệ |
| Finalize/publish hoặc tự động viết nhiều chương | Không | Quy trình phê duyệt rõ ràng; không tự giả mạo duyệt |
| Truy cập máy công ty, merge PR, xóa dữ liệu | Không | Yêu cầu riêng, nêu chính xác phạm vi |

## 5. Mẫu báo cáo cuối mỗi giai đoạn

Trả lời bằng tiếng Việt, ngắn gọn và kiểm chứng được:

- **Tác phẩm:** tên + tình trạng project mới hay hiện hữu (không chia sẻ đường dẫn private lên GitHub).
- **Đã làm:** đề xuất hay đã lưu thật, thao tác nào, ở đâu.
- **Đã kiểm chứng:** commit/branch nếu sửa code; project identity, số lượng dàn ý, blueprint, draft, finalized khi đọc được.
- **Đang chờ tác giả:** nội dung cần duyệt hoặc thông số cần quyết định.
- **Bước tiếp:** một hành động tiếp theo hợp lý; **không tự chạy** sau khi chờ phê duyệt.
- **Bảo vệ dữ liệu:** chưa sửa nguyên tác/máy khác, có sao lưu hay chưa, giới hạn hiện tại.

## 6. Kiểm chứng năng lực — đừng nhầm thiết kế với tính năng đã phát hành

- New Project qua GUI: **đã có**; cần kiểm tra app chạy ở commit nào.
- Story Bridge config/architecture/character/outline: **có các đường propose/review**, cần đối chiếu khả năng cụ thể từng loại với code tại commit hiện thời.
- Pilot nhập blueprint/draft qua runner và Stage Batch CLI: **đường triển khai có giới hạn**, không tương đương native ChatGPT Batch Writer UI hoàn thiện.
- Reader: có các cải tiến trong **PR #13** nhưng kiểm tra trạng thái merge/build trước khi nói đã có trên máy khác.
- ChatGPT Plus / cuộc trò chuyện **không tự cấp quyền MCP, Remote Desktop hoặc OpenAI API**. Muốn chạy qua máy, kết nối phải đang hoạt động và được tác giả cho phép.
- Đặc tả roadmap và câu chữ “sẽ triển khai” **không được** trình bày thành chức năng đã nghiệm thu.

**Mục tiêu sau khi đọc tài liệu này:** ChatGPT bắt đầu đúng một truyện mới, thu thập ý tưởng, trình creative brief và hỏi tác giả bước cần duyệt — không tự nhập nhằng với truyện cũ, dữ liệu không có hoặc khả năng chưa triển khai.
