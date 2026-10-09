import type { PromptLanguageTemplate } from './prompt-language'

/**
 * Vietnamese writing profile layered over verified English output contracts.
 * JSON keys, placeholder names, output limits, and author facts stay intact.
 */
const CORE_LANGUAGE_RULES = [
  '【NGÔN NGỮ SÁNG TÁC: TIẾNG VIỆT】',
  '- Viết lời kể, hội thoại, nội tâm, tóm tắt và giá trị văn bản sáng tạo bằng tiếng Việt tự nhiên, có dấu.',
  '- Tránh câu dịch máy, lặp khuôn sáo, kết đoạn bằng triết lý chung chung hoặc tóm tắt lại điều vừa kể.',
  '- Mỗi nhân vật có giọng nói phù hợp xuất thân, mục tiêu và hoàn cảnh; nhất quán cách xưng hô.',
  '- Dữ kiện tác giả đã xác nhận, trạng thái nhân vật, quan hệ, mốc thời gian, sự kiện chưa tiết lộ là bắt buộc.',
  '- Khi trả về JSON: giữ nguyên mọi tên khóa, enum, kiểu dữ liệu, giới hạn độ dài và cấu trúc theo hợp đồng; chỉ viết giá trị văn bản tự do bằng tiếng Việt.',
  '- Giữ nguyên tên riêng, mã kỹ thuật, trích dẫn nguyên văn và cú pháp biến mẫu trong prompt. Không dịch tên khóa JSON.',
].join('\n')

const CHAPTER_CRAFT = [
  '【YÊU CẦU VIẾT CHƯƠNG TIẾNG VIỆT】',
  '- Kể bằng hành động, phản ứng, cảm giác và hội thoại có mục đích; phát triển xung đột theo nguyên nhân và hệ quả.',
  '- Chuyển cảnh tự nhiên, không lặp hành động ở đoạn kết chương trước và không thay đổi điểm nhìn vô cớ.',
  '- Bám độ dài mục tiêu bằng các đơn vị từ tiếng Việt; không chèn tình tiết hoặc miêu tả vô nghĩa để đủ số từ.',
  '- Không tiết lộ sự kiện dàn ý tương lai. Kết thúc tại trạng thái hoặc điểm treo của chương hiện tại.',
  '- Chỉ xuất văn xuôi của chương, không bình luận AI, kế hoạch, tiêu đề Markdown hoặc ghi chú hậu trường.',
].join('\n')

const REVISION_CRAFT = [
  '【BIÊN TẬP VĂN TIẾNG VIỆT】',
  '- Sửa câu gượng gạo, lặp từ, dài dòng và đối thoại thiếu tự nhiên.',
  '- Không đổi dữ kiện, quan hệ, năng lực, địa điểm, điểm nhìn hoặc mốc thời gian tác giả đã xác nhận.',
  '- Giữ mạch văn và độ dài mục tiêu; không kéo dài bằng tình tiết thừa.',
].join('\n')

/** Existing structural output contracts take precedence over prose style. */
export function vietnamesePromptOverlay(
  key: string,
  english: PromptLanguageTemplate,
): PromptLanguageTemplate {
  const chapter = key === 'first_chapter_draft' || key === 'next_chapter_draft'
  const revision = key === 'refine_chapter' || key === 'refine_from_review' || key === 'edit_selected_text'
  const discipline = chapter ? CHAPTER_CRAFT : revision ? REVISION_CRAFT : ''
  return {
    systemRole: CORE_LANGUAGE_RULES + '\n\n' + english.systemRole,
    content: discipline ? discipline + '\n\n' + english.content : english.content,
    systemSuffix: [english.systemSuffix ?? '', CORE_LANGUAGE_RULES, discipline]
      .filter(Boolean).join('\n\n'),
  }
}
