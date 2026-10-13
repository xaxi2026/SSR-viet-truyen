# SSR-viet-truyen — quy hoạch thư mục Windows sau khi gom dự án (13/10/2026)

**Phạm vi:** máy phát triển Windows VCC-PHUONG23. Đây là hướng dẫn **đường dẫn trên máy**, không phải tạo bản phát hành hay thay đổi GitHub `master`. Tài liệu đi kèm [Issue #20](https://github.com/xaxi2026/SSR-viet-truyen/issues/20), [PR #19](https://github.com/xaxi2026/SSR-viet-truyen/pull/19) và [PR #22](https://github.com/xaxi2026/SSR-viet-truyen/pull/22).

## Thư mục chung duy nhất chứa dữ liệu thật

```text
D:\SSR-NGHIA\SSR-viet-truyen\
  Writer\                 SSR-viet-truyen Writer Pilot mới (Hồ sơ cốt truyện, manh mối/tuyến truyện)
  Writer-Base\            Git repository chính (.git); bao gồm dự án test-1 và dữ liệu chưa công bố
  Reader\                 Ứng dụng SSR Reader Windows portable: SSR Reader.exe
  Reader-Source\          Git worktree chứa mã nguồn SSR Reader
  Truyen\SSR-tieu-thuyet\   Dữ liệu tiểu thuyết, gồm SQLite và mọi tệp WAL/SHM nếu có
  Dependencies\Writer-node_modules\  pnpm/Electron packages cho Writer
  Profiles\               Cấu hình các bản Pilot được giữ riêng
  Launchers\              4 lệnh CMD để khởi động app (gồm lệnh DEV cũ)
  Backups\                ZIP test-1, snapshot Git admin, các CMD/.lnk cũ, phụ thuộc trung gian để rollback
  HUONG_DAN_THU_MUC.txt    Hướng dẫn trên máy và tình trạng bảo tồn dữ liệu
```

**Dữ liệu thực tế nằm dưới đúng một thư mục gốc**. Các đường dẫn ở dưới **chỉ là NTFS junction để tương thích**, không phải các bản sao:

```text
D:\SSR-NGHIA\SSR-viet truyen  ->  D:\SSR-NGHIA\SSR-viet-truyen\Writer-Base
D:\SSR-NGHIA\SSR-viet-truyen-story-bible-20261013  ->  D:\SSR-NGHIA\SSR-viet-truyen\Writer
D:\SSR-NGHIA\SSR- tieu thuyet  ->  D:\SSR-NGHIA\SSR-viet-truyen\Truyen\SSR-tieu-thuyet
```

**Không được xóa các junction tương thích trong giai đoạn này.** Một số gói pnpm có đường dẫn liên kết tuyệt đối tới đường dẫn Writer trước khi di chuyển; liên kết gần đây của dự án SQLite cũng có thể dùng đường dẫn cũ. Chỉ gỡ sau khi đã thay các phụ thuộc/đường dẫn, thử lại ứng dụng và xác nhận không có dự án mất khỏi danh sách gần đây.

## Kiểm tra đã thực hiện, không suy diễn quá mức

- Xác nhận Writer/Electron đã đóng hoàn toàn trước khi di chuyển; không dừng cưỡng bức chương trình đang làm việc.
- Thư mục Reader Windows và worktree Reader chuyển vào thư mục chung; EXE khởi động, giao diện `Responding=True`.
- Writer, repository Git gốc, tiểu thuyết (gồm SQLite), profile và launchers được chuyển vào thư mục chung. Source Writer cũ còn lại đã được đối chiếu **555/555 SHA256** với source mới trước khi xóa bản trùng.
- **Ba Git worktree** vẫn đúng HEAD và branch: Writer-Base `5df9f0c`, Writer `b6cb50b`, Reader-Source `ae5d1b8`. Git status Writer có **hai file audit untracked đã tồn tại từ trước**; không xóa hay tự commit.
- Backup ZIP `test-1` đã được đối chiếu hash SHA256: `86425AD6547D825E9B9CBAE9E63BB250D426675526BB596E65E8C91DE08C8689` (file backup, không phải hash SQLite).
- Cả Writer và Reader là **hai ứng dụng riêng**, lối tắt Desktop đã cập nhật đích. Smoke Writer bằng **profile thử mới, không mở test-1**, ứng dụng mở và đóng được, không sửa nội dung truyện.
- Không thay Kaspersky, không merge PR/branch, không tự công bố truyện, không sửa nguyên tác hay SQLite.
- Đây **chưa phải** full regression/e2e sau khi chuyển đường dẫn; chỉ đã xác nhận Git, tồn tại file quan trọng, lối tắt và Writer GUI smoke. Cần người dùng mở lại đúng project và nghiệm thu.

## Cách dùng và phần lưu riêng theo chuẩn ứng dụng

**Để viết:** nhấn shortcut `SSR-viet truyen` trên Desktop, hiện mở **Writer Pilot mới** bằng bản build ở `Writer\dist`, profile `Profiles\Manh-Moi-Tuyen-Truyen`. Hai shortcut Pilot cũ vẫn dùng hai profile độc lập.

**Để đọc:** nhấn `SSR Reader - Doc truyen (Pilot)`; chạy `Reader\SSR Reader.exe`, không cần mở Writer. Thư viện sách đọc độc giả vẫn ở `%APPDATA%\SSR Reader\reader-library` theo chuẩn Electron, nằm **ngoài thư mục nguồn**. Đừng coi dữ liệu ứng dụng độc giả là một bản sao project Writer.

**Để mở `test-1`:** đường dẫn mới là `Writer-Base\SSR-truyen\test-1`; đường dẫn cũ chạy qua junction tương thích. Không sửa test-1 để nghiệm thu việc di chuyển. **Để mở tiểu thuyết:** đường dẫn mới `Truyen\SSR-tieu-thuyet`.

## Sau khi nghiệm thu

1. Người dùng mở Writer và Reader từ Desktop, kiểm tra truyện thật chỉ ở chế độ đọc, không thay nội dung.
2. Nếu mọi dữ liệu còn nguyên và hướng dẫn rõ ràng, ưu tiên **quay lại sản xuất truyện**, như quyết định tại Issue #20.
3. Để bỏ các junction bên ngoài thư mục chung, cần giai đoạn riêng: re-link/reinstall pnpm tại đường dẫn mới, sửa đường dẫn project gần đây trong cấu hình *bằng giao diện hoặc migration đã kiểm thử*, sau đó mới gỡ alias. Không tự gỡ khi chưa nghiệm thu.
4. Không phát triển app điện thoại trước; Reader Windows đã tách, mobile để sau.

**Chú ý:** tài liệu có tên thư mục nhưng không chứa dữ liệu truyện, nội dung chương, SQLite hoặc khóa API; tất cả dữ liệu riêng chỉ nằm trên máy người dùng.
