/**
 * Strictly anchored Vietnamese translations for interpolated confirmation dialogs.
 * Returns undefined for unknown text. Never process author prose or project content.
 */
const rules: ReadonlyArray<readonly [RegExp,string]> = [
  [/^Delete project ([^\n]+)\nThis removes its manuscripts, architecture, characters, blueprints, knowledge base, and all project data\.$/u, 'Xóa dự án $1?\nThao tác này sẽ xóa bản thảo, cấu trúc truyện, nhân vật, dàn ý, kho tri thức và toàn bộ dữ liệu dự án.'],
  [/^Project (.+) deleted$/u, 'Đã xóa dự án $1'],
  [/^Remove ([^\n]+) from recent projects\?\nThis only removes the list entry and does not delete project files\.$/u, 'Xóa $1 khỏi danh sách dự án gần đây?\nChỉ xóa mục trong danh sách, không xóa tệp dự án.'],
  [/^Removed (.+) from recent projects$/u, 'Đã xóa $1 khỏi danh sách dự án gần đây'],
  [/^Delete ([^\n]+) v([\d.]+)\nThis permanently removes the draft and related review\/revision artifacts\.$/u, 'Xóa bản nháp $1 v$2?\nThao tác này xóa vĩnh viễn bản nháp cùng dữ liệu đánh giá và biên tập liên quan.'],
  [/^Clear ([^\n]+)\nThis removes only this architecture section and preserves the other sections, blueprints, and manuscript\.$/u, 'Xóa nội dung $1?\nChỉ xóa phần cấu trúc truyện này; những phần khác, dàn ý chương và bản thảo được giữ lại.'],
  [/^Could not clear (.+)$/u, 'Không thể xóa $1'],
  [/^Cleared (.+)$/u, 'Đã xóa $1'],
  [/^Clear (.+)$/u, 'Xóa $1'],
  [/^Delete character ([^\n]+)\? This cannot be undone\.$/u, 'Xóa nhân vật $1? Không thể hoàn tác.'],
  [/^(\S[^\n]*) has unsaved changes\. Discard them and close\?$/u, '$1 có thay đổi chưa lưu. Hủy những thay đổi này và đóng?'],
  [/^Open ([^\n]+)$/u, 'Mở $1'],
  [/^Uninstall ([^\n]+)\? Its bindings in the current project will also be removed\.$/u, 'Gỡ cài đặt $1? Liên kết của công cụ trong dự án hiện tại cũng sẽ bị xóa.'],
  [/^Uninstall (.+)$/u, 'Gỡ cài đặt $1'],
  [/^Install ([^\n]+) in the global writing skill library\? It will be downloaded and validated again\.$/u, 'Cài $1 vào kho kỹ năng viết toàn cục? Tệp sẽ được tải và kiểm tra lại.'],
  [/^Generate ([^\n]+) with AI$/u, 'Dùng AI tạo $1'],
  [/^AI Generate (.+)$/u, 'AI tạo $1'],
  [/^AI Regenerate (.+)$/u, 'AI tạo lại $1'],
  [/^These items may be affected by ([^\n]+) This preview is not saved\.$/u, 'Những mục này có thể bị ảnh hưởng bởi $1. Bản xem trước chưa được lưu.'],
  [/^Special requirements for ([^\n]+) such as limitations on the protagonist advantage$/u, 'Yêu cầu đặc biệt cho $1, chẳng hạn giới hạn lợi thế của nhân vật chính'],
  [/^All pasted text and selected files will be sent to the following model endpoint to extract character cards\. Preview and confirmation are required before saving to the roster; the character graph will not be overwritten directly\.\n\nModel: ([^\n]+)\nEndpoint: ([^\n]+)\n\nSend and extract\?$/u, 'Toàn bộ văn bản và tệp đã chọn sẽ được gửi tới mô hình AI để trích xuất hồ sơ nhân vật. Bạn phải xem trước và xác nhận mới lưu vào danh sách nhân vật; sơ đồ quan hệ sẽ không bị ghi đè trực tiếp.\n\nMô hình: $1\nĐiểm kết nối: $2\n\nGửi để trích xuất?'],
  [/^The planning material is now stored only in this project's local knowledge base\.\n\nIf you continue, all selected text will be sent to the currently configured model endpoint to extract editable character cards:\nModel: ([^\n]+)\nEndpoint: ([^\n]+)\n\nSend the text and extract character cards\?$/u, 'Tài liệu lập kế hoạch hiện chỉ nằm trong kho tri thức cục bộ của dự án.\n\nNếu tiếp tục, toàn bộ văn bản đã chọn sẽ được gửi đến điểm kết nối mô hình đã cấu hình để trích xuất hồ sơ nhân vật có thể chỉnh sửa:\nMô hình: $1\nĐiểm kết nối: $2\n\nGửi văn bản và trích xuất hồ sơ?'],
]
export function localizeVietnameseCriticalUi(input: string): string | undefined {
  for (const [pattern, output] of rules) if (pattern.test(input)) return input.replace(pattern,output)
  return undefined
}
