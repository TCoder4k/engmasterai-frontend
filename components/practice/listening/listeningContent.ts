// Curated, SELF-AUTHORED seed content for Listening Dictation practice
// (Sprint 03C, extended for the 03E catalog). Locked rules (migration plan,
// Decisions #4):
//  - Never copy sentences verbatim from ETS or any commercial TOEIC test
//    material — every sentence below is originally written for this app.
//  - Versioned so it reads unambiguously as temporary: a real backend
//    transcript/segment model (Sprint 04+) is expected to replace this file
//    entirely, not extend it indefinitely.
// Catalog metadata (topic/level/estimatedMinutes) is typed and lives with
// the content; every catalog count is DERIVED from this array at render
// time — never hardcoded.
export const LISTENING_CONTENT_VERSION = 'seed-v1';

export type ListeningLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export type ListeningTopic = 'TOEIC' | 'Business' | 'Daily Conversations' | 'Travel' | 'Technology' | 'Job Interview';

export interface DictationSegment {
  id: number;
  textEn: string;
  textVi: string;
  normalizedAnswer: string;
  durationSeconds: number;
}

export interface DictationLesson {
  id: string;
  title: string;
  description: string;
  topic: ListeningTopic;
  level: ListeningLevel;
  estimatedMinutes: number;
  speaker: string;
  segments: DictationSegment[];
}

// Lean catalog-card shape derived from the full lesson (segmentCount is
// computed, never stored, so it can't drift from the real segments).
export interface ListeningLessonSummary {
  id: string;
  title: string;
  description: string;
  topic: ListeningTopic;
  level: ListeningLevel;
  estimatedMinutes: number;
  segmentCount: number;
  version: string;
}

const normalize = (text: string): string =>
  text.trim().toLowerCase().replace(/[^a-z0-9'\s-]/g, '');

const segment = (id: number, textEn: string, textVi: string, durationSeconds: number): DictationSegment => ({
  id,
  textEn,
  textVi,
  normalizedAnswer: normalize(textEn),
  durationSeconds,
});

export const DICTATION_LESSONS: DictationLesson[] = [
  {
    id: 'office-relocation-notice',
    title: 'Office Relocation Notice',
    description: 'A short internal briefing about an office move.',
    topic: 'Business',
    level: 'B2',
    estimatedMinutes: 3,
    speaker: 'Ms. Carter',
    segments: [
      segment(1, 'Good morning everyone, thank you for joining this short briefing.', 'Chào buổi sáng mọi người, cảm ơn các bạn đã tham dự buổi họp ngắn này.', 4),
      segment(2, 'Starting next Monday, our office will move to the third floor.', 'Bắt đầu từ thứ Hai tới, văn phòng của chúng ta sẽ chuyển lên tầng ba.', 5),
      segment(3, 'Please pack your personal belongings into the boxes provided by Friday.', 'Vui lòng đóng gói đồ dùng cá nhân vào các thùng được cung cấp trước thứ Sáu.', 5),
      segment(4, 'The new workstations already have updated network cables installed.', 'Các bàn làm việc mới đã được lắp sẵn dây mạng cập nhật.', 5),
      segment(5, 'If you have any questions, please contact the facilities team directly.', 'Nếu có thắc mắc, vui lòng liên hệ trực tiếp với đội ngũ quản lý cơ sở vật chất.', 5),
    ],
  },
  {
    id: 'flight-delay-announcement',
    title: 'Flight Delay Announcement',
    description: 'An airport gate announcement about a short delay.',
    topic: 'Travel',
    level: 'B1',
    estimatedMinutes: 3,
    speaker: 'Gate Agent',
    segments: [
      segment(1, 'Attention passengers, we regret to announce a short delay.', 'Kính thưa quý hành khách, chúng tôi rất tiếc phải thông báo về một sự chậm trễ ngắn.', 4),
      segment(2, 'Flight two-one-four to Chicago will now depart at four fifteen.', 'Chuyến bay hai một bốn đi Chicago giờ sẽ khởi hành lúc bốn giờ mười lăm.', 5),
      segment(3, 'This delay is due to a temporary technical inspection.', 'Sự chậm trễ này là do việc kiểm tra kỹ thuật tạm thời.', 4),
      segment(4, 'Passengers may wait comfortably near gate twelve until boarding.', 'Hành khách có thể chờ thoải mái gần cổng số mười hai cho đến khi lên máy bay.', 5),
      segment(5, 'We apologize for any inconvenience this may have caused you.', 'Chúng tôi xin lỗi vì sự bất tiện này có thể đã gây ra cho quý khách.', 5),
    ],
  },
  {
    id: 'quarterly-sales-update',
    title: 'Quarterly Sales Update',
    description: 'A manager summarizes quarterly revenue and next steps.',
    topic: 'TOEIC',
    level: 'B2',
    estimatedMinutes: 3,
    speaker: 'Mr. Alvarez',
    segments: [
      segment(1, 'Let me walk you through the highlights of this quarter.', 'Hãy để tôi trình bày những điểm nổi bật của quý này.', 4),
      segment(2, 'Overall revenue increased by twelve percent compared to last year.', 'Doanh thu tổng thể tăng mười hai phần trăm so với năm ngoái.', 5),
      segment(3, 'Our online store performed particularly well during the holiday season.', 'Cửa hàng trực tuyến của chúng ta hoạt động đặc biệt tốt trong mùa lễ hội.', 5),
      segment(4, 'However, shipping costs also rose due to higher fuel prices.', 'Tuy nhiên, chi phí vận chuyển cũng tăng do giá nhiên liệu cao hơn.', 5),
      segment(5, 'Next quarter, we plan to expand into two new regional markets.', 'Quý tới, chúng tôi dự định mở rộng sang hai thị trường khu vực mới.', 5),
    ],
  },
  {
    id: 'ordering-at-a-cafe',
    title: 'Ordering at a Café',
    description: 'A simple everyday conversation about ordering drinks.',
    topic: 'Daily Conversations',
    level: 'A2',
    estimatedMinutes: 2,
    speaker: 'Barista',
    segments: [
      segment(1, 'Hi there, what can I get for you today?', 'Xin chào, hôm nay bạn muốn dùng gì?', 3),
      segment(2, 'I would like a small coffee with milk, please.', 'Cho tôi một ly cà phê nhỏ với sữa nhé.', 4),
      segment(3, 'Would you like anything to eat with that?', 'Bạn có muốn dùng gì ăn kèm không?', 3),
      segment(4, 'Yes, one blueberry muffin to go, please.', 'Vâng, cho tôi một bánh muffin việt quất mang đi.', 4),
      segment(5, 'That will be six dollars and fifty cents in total.', 'Tổng cộng của bạn là sáu đô la năm mươi xu.', 4),
    ],
  },
  {
    id: 'job-interview-introduction',
    title: 'Job Interview Introduction',
    description: 'The opening minutes of a friendly job interview.',
    topic: 'Job Interview',
    level: 'B1',
    estimatedMinutes: 3,
    speaker: 'Interviewer',
    segments: [
      segment(1, 'Thank you for coming in today, please have a seat.', 'Cảm ơn bạn đã đến hôm nay, mời bạn ngồi.', 4),
      segment(2, 'Could you start by telling us a little about yourself?', 'Bạn có thể bắt đầu bằng việc giới thiệu đôi chút về bản thân không?', 4),
      segment(3, 'I have worked in customer service for almost three years.', 'Tôi đã làm việc trong lĩnh vực chăm sóc khách hàng gần ba năm.', 4),
      segment(4, 'What would you say is your greatest professional strength?', 'Bạn nghĩ điểm mạnh lớn nhất trong công việc của mình là gì?', 4),
      segment(5, 'I stay calm under pressure and communicate clearly with customers.', 'Tôi giữ bình tĩnh khi gặp áp lực và giao tiếp rõ ràng với khách hàng.', 5),
    ],
  },
];

export const getLessonSummaries = (): ListeningLessonSummary[] =>
  DICTATION_LESSONS.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    topic: lesson.topic,
    level: lesson.level,
    estimatedMinutes: lesson.estimatedMinutes,
    segmentCount: lesson.segments.length,
    version: LISTENING_CONTENT_VERSION,
  }));

export const getLessonById = (id: string): DictationLesson | undefined =>
  DICTATION_LESSONS.find((lesson) => lesson.id === id);
