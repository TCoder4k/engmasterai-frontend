// Marketing content for the public landing page.
//
// ⚠️ THIS IS PLACEHOLDER MARKETING COPY, NOT PRODUCT DATA. ⚠️
//
// The partner names, the testimonials and their authors, the learner
// counts, the accuracy figures and the price points below are all
// illustrative — they were carried over from the design reference at the
// product owner's explicit instruction so the page reads at full density.
// Nothing here is measured, and nothing in the app produces these numbers.
//
// It lives in ONE module precisely because of that: replacing it with real
// testimonials, real partners and a real price list before any public
// launch is a single-file edit, not a hunt through twelve components.
//
// Anything the app can actually back up (the three learning modules, the
// Học → Luyện → Ôn loop, the review scheduler) is written in the components
// themselves and describes real behaviour.

export interface PartnerLogo {
  name: string;
  sector: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  avatar: string;
  content: string;
  rating: number;
  scoreImprovement: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPriceMonthly: number;
  popular?: boolean;
  features: string[];
  ctaText: string;
  /** Where the button goes. Every plan lands on a route that exists. */
  ctaTo: string;
}

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  iconName: 'Mic' | 'RotateCcw' | 'MessageSquareText' | 'Sparkles' | 'Target' | 'Smartphone';
  tag: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface SentenceAnalysis {
  original: string;
  corrected: string;
  grammarScore: number;
  naturalnessScore: number;
  vocabularyScore: number;
  explanation: string[];
  nativeAlternatives: string[];
  phoneticTip: string;
}

export const PARTNER_LOGOS: PartnerLogo[] = [
  { name: 'Shopee', sector: 'Công nghệ' },
  { name: 'FPT Software', sector: 'Tập đoàn CNTT' },
  { name: 'Techcombank', sector: 'Tài chính - Ngân hàng' },
  { name: 'VNG Corporation', sector: 'Giải trí & AI' },
  { name: 'VinGroup', sector: 'Đa ngành' },
  { name: 'Vietcombank', sector: 'Ngân hàng hàng đầu' },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Trần Minh Hoàng',
    role: 'Senior Frontend Engineer',
    company: 'Shopee Vietnam',
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
    content:
      'Từng rất tự ti khi họp với đồng nghiệp người Singapore. Sau 3 tháng luyện nói hàng ngày cùng EngMaster AI, điểm phát âm phản hồi thời gian thực giúp mình sửa ngay lỗi lướt âm. Tuần trước vừa pass phỏng vấn lên Tech Lead!',
    rating: 5,
    scoreImprovement: 'Tự tin họp 100% tiếng Anh',
  },
  {
    id: '2',
    name: 'Nguyễn Bích Phương',
    role: 'Product Marketing Lead',
    company: 'Techcombank',
    avatar:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250',
    content:
      'Tính năng kiểm tra ngữ cảnh bài viết và đề xuất cách diễn đạt chuẩn người bản xứ cực kỳ hữu ích. Mình dùng để sửa email đối tác và slide thuyết trình hàng ngày. Tiết kiệm cả tiếng đồng hồ tra từ điển.',
    rating: 5,
    scoreImprovement: 'IELTS Speaking 6.0 → 7.5',
  },
  {
    id: '3',
    name: 'Phạm Đức Anh',
    role: 'Sinh viên năm cuối',
    company: 'Đại học Bách Khoa Hà Nội',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
    content:
      'Thuật toán lặp lại ngắt quãng (Spaced Repetition) ở đây xịn hơn Anki vì nó gắn từ vựng vào ngữ cảnh thực tế. Mình tăng từ 520 lên 860 TOEIC chỉ trong 10 tuần ôn tập đúng 20 phút mỗi ngày.',
    rating: 5,
    scoreImprovement: 'TOEIC 520 → 860',
  },
];

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Trải Nghiệm',
    description: 'Dành cho người mới bắt đầu khám phá phương pháp học AI cá nhân hóa.',
    monthlyPrice: 0,
    yearlyPriceMonthly: 0,
    features: [
      '15 phút luyện giao tiếp AI mỗi ngày',
      'Thư viện 500 từ vựng cốt lõi',
      'Sửa lỗi phát âm cơ bản (3 lần/ngày)',
      'Học trên Mobile & Laptop',
      'Cộng đồng hỗ trợ học tập',
    ],
    ctaText: 'Bắt đầu miễn phí',
    ctaTo: '/register',
  },
  {
    id: 'pro',
    name: 'Pro Cá Nhân',
    description: 'Lựa chọn phổ biến nhất giúp bứt phá phản xạ nói & làm chủ tiếng Anh công sở.',
    monthlyPrice: 199000,
    yearlyPriceMonthly: 119000,
    popular: true,
    features: [
      'Không giới hạn thời gian giao tiếp với AI',
      'Phản hồi phát âm theo chuẩn âm IPA bản xứ',
      'Trợ lý sửa bài viết & email chuyên nghiệp',
      'Thuật toán Spaced Repetition tự động xếp lịch',
      '100+ kịch bản roleplay (Phỏng vấn, Thuyết trình)',
      'Báo cáo tiến độ chi tiết hàng tuần',
      'Hỗ trợ ưu tiên 24/7',
    ],
    ctaText: 'Nâng cấp Pro ngay',
    ctaTo: '/register',
  },
  {
    id: 'enterprise',
    name: 'Doanh Nghiệp / Nhóm',
    description: 'Dành cho công ty, trung tâm đào tạo hoặc nhóm học từ 5 thành viên trở lên.',
    monthlyPrice: 499000,
    yearlyPriceMonthly: 349000,
    features: [
      'Tất cả tính năng của gói Pro',
      'Bao gồm 5 tài khoản thành viên',
      'Dashboard quản lý tiến độ tổng quan',
      'Tùy chỉnh giáo trình theo ngành nghề công ty',
      'Xuất chứng nhận & báo cáo KPI nhân sự',
      'Quản lý tài khoản hỗ trợ riêng (Account Manager)',
    ],
    ctaText: 'Liên hệ tư vấn nhóm',
    ctaTo: '/register',
  },
];

export const FEATURES: FeatureItem[] = [
  {
    id: 'f1',
    title: 'Nhận diện giọng nói AI chuẩn xác 99.4%',
    description:
      'Công nghệ phân tích sóng âm phát hiện chính xác từng âm tiết chưa chuẩn, khẩu hình miệng và trọng âm câu giúp bạn sửa ngay lập tức.',
    iconName: 'Mic',
    tag: 'Công nghệ độc quyền',
  },
  {
    id: 'f2',
    title: 'Lịch ôn Spaced Repetition thông minh',
    description:
      'Hệ thống tự động tính toán thời điểm bộ não sắp quên từ vựng để đưa ra bài tập nhắc lại đúng lúc, giúp nhớ lâu gấp 4 lần.',
    iconName: 'RotateCcw',
    tag: 'Khoa học trí nhớ',
  },
  {
    id: 'f3',
    title: 'Roleplay tình huống thực tế 1-1',
    description:
      'Thực hành hội thoại với AI trong hơn 100 kịch bản: Phỏng vấn xin việc, đàm phán hợp đồng, gọi món nhà hàng hay đặt vé máy bay.',
    iconName: 'MessageSquareText',
    tag: 'Phản xạ tự nhiên',
  },
  {
    id: 'f4',
    title: 'Sửa lỗi ngữ pháp & diễn đạt tự nhiên',
    description:
      'Không chỉ chỉ ra lỗi sai, AI còn gợi ý 3 cách diễn đạt tự nhiên chuẩn bản xứ (Idiomatic Expressions) phù hợp với bối cảnh.',
    iconName: 'Sparkles',
    tag: 'Viết chuẩn Business',
  },
  {
    id: 'f5',
    title: 'Lộ trình cá nhân hóa theo mục tiêu',
    description:
      'Thiết kế riêng theo trình độ hiện tại và mục tiêu đầu ra (IELTS 7.0, TOEIC 850, hoặc giao tiếp doanh nghiệp).',
    iconName: 'Target',
    tag: 'Tối ưu thời gian',
  },
  {
    id: 'f6',
    title: 'Học mọi lúc, đồng bộ đa nền tảng',
    description:
      'Trải nghiệm mượt mà trên iPhone, Android, Tablet và Máy tính. Dữ liệu tiến độ học tập được lưu đồng bộ đám mây tức thì.',
    iconName: 'Smartphone',
    tag: 'Linh hoạt 24/7',
  },
];

export const SAMPLE_SENTENCES = [
  {
    label: 'Email công việc',
    text: 'I am write this email to ask about the status of project for last week.',
  },
  {
    label: 'Phỏng vấn xin việc',
    text: 'I have 3 years experience in marketing and I very want to join your team.',
  },
  {
    label: 'Giao tiếp hàng ngày',
    text: 'Yesterday I go to market for buy some foods but it was rain very big.',
  },
  {
    label: 'Giao tiếp thuyết trình',
    text: 'Today I will speak about our new product feature who make customer happy.',
  },
] as const;

export const SAMPLE_ANALYSIS_PRESETS: Record<string, SentenceAnalysis> = {
  'I am write this email to ask about the status of project for last week.': {
    original: 'I am write this email to ask about the status of project for last week.',
    corrected: 'I am writing this email to inquire about the status of the project from last week.',
    grammarScore: 78,
    naturalnessScore: 82,
    vocabularyScore: 85,
    explanation: [
      'Dùng "writing" (thì hiện tại tiếp diễn) thay vì "write" sau động từ to be "am".',
      'Nên thay "ask" bằng "inquire about" để giọng văn trang trọng hơn trong email công việc.',
      'Thêm mạo từ xác định "the" trước "project" và thay "for last week" bằng "from last week".',
    ],
    nativeAlternatives: [
      "I am writing to follow up on the status of last week's project.",
      'Could you please provide an update regarding the progress of the project from last week?',
    ],
    phoneticTip:
      'Chú ý phát âm đuôi /ŋ/ trong "writing" và trọng âm rơi vào âm tiết thứ 2 trong "inquire" (/ɪnˈkwaɪər/).',
  },
  'I have 3 years experience in marketing and I very want to join your team.': {
    original: 'I have 3 years experience in marketing and I very want to join your team.',
    corrected: 'I have 3 years of experience in marketing, and I am very eager to join your team.',
    grammarScore: 80,
    naturalnessScore: 75,
    vocabularyScore: 82,
    explanation: [
      'Thêm giới từ "of" sau "3 years" → "3 years of experience".',
      'Tránh dùng "very want" vì "very" không đi trực tiếp với động từ thường. Nên dùng "really want" hoặc "am very eager to".',
    ],
    nativeAlternatives: [
      'With 3 years of experience in marketing, I am extremely enthusiastic about joining your team.',
      'I bring 3 years of marketing experience and would love the opportunity to contribute to your team.',
    ],
    phoneticTip:
      'Phát âm từ "experience" với 4 âm tiết: /ɪkˈspɪə.ri.əns/ với trọng âm rơi vào âm thứ 2.',
  },
  'Yesterday I go to market for buy some foods but it was rain very big.': {
    original: 'Yesterday I go to market for buy some foods but it was rain very big.',
    corrected: 'Yesterday I went to the market to buy some groceries, but it rained heavily.',
    grammarScore: 62,
    naturalnessScore: 68,
    vocabularyScore: 70,
    explanation: [
      'Chia quá khứ đơn "went" thay vì "go" vì có trạng từ "Yesterday".',
      'Dùng "to buy" chỉ mục đích thay vì "for buy".',
      'Dùng "groceries" tự nhiên hơn "foods", và "rained heavily" thay cho "rain very big".',
    ],
    nativeAlternatives: [
      'I headed to the market yesterday to pick up some food, but it suddenly poured with rain.',
      'It rained heavily yesterday when I was heading out to buy groceries.',
    ],
    phoneticTip: 'Phát âm đuôi quá khứ /d/ trong "rained" /reɪnd/ và trọng âm "heavily" /ˈhev.ə.li/.',
  },
  'Today I will speak about our new product feature who make customer happy.': {
    original: 'Today I will speak about our new product feature who make customer happy.',
    corrected: 'Today I will present our new product features that make customers happy.',
    grammarScore: 72,
    naturalnessScore: 80,
    vocabularyScore: 84,
    explanation: [
      'Dùng mệnh đề quan hệ "that" hoặc "which" chỉ vật (feature), không dùng "who" (chỉ người).',
      'Thay "speak about" bằng "present" tự nhiên hơn trong bối cảnh thuyết trình.',
      'Dùng danh từ số nhiều "customers" hoặc "our customers".',
    ],
    nativeAlternatives: [
      "Today, I'd like to walk you through our latest product features designed to delight customers.",
      'I will be presenting our new product feature that boosts customer satisfaction.',
    ],
    phoneticTip:
      'Nhấn trọng âm rõ ở "present" (động từ /prɪˈzent/) và "delight" /dɪˈlaɪt/.',
  },
};

export const FAQS: FAQItem[] = [
  {
    // The reference had "so with" here — a typo, not a design choice.
    question: 'EngMaster AI khác gì so với các ứng dụng học tiếng Anh truyền thống?',
    answer:
      'EngMaster AI ứng dụng mô hình ngôn ngữ lớn thế hệ mới được tối ưu riêng cho người Việt. Thay vì học vẹt ngữ pháp hoặc làm bài trắc nghiệm thụ động, bạn được tương tác 1-1 bằng giọng nói thật, nhận phản hồi ngay lập tức về phát âm, ngữ pháp và ngữ cảnh diễn đạt.',
  },
  {
    question: 'Tôi mất gốc tiếng Anh hoặc rất bận rộn thì có học được không?',
    answer:
      'Rất phù hợp! Lộ trình của EngMaster AI tự động chia nhỏ bài học thành các phiên 10-15 phút ngắn gọn mỗi ngày. Thuật toán Spaced Repetition đảm bảo bạn ôn lại đúng kiến thức sắp quên mà không tốn quá nhiều thời gian.',
  },
  {
    question: 'Khả năng nhận diện giọng nói có chính xác với giọng vùng miền Việt Nam không?',
    answer:
      'Hệ thống nhận diện giọng nói AI của chúng tôi được huấn luyện trên hơn 500,000 mẫu giọng nói thực tế của người Việt học tiếng Anh, giúp phân biệt chính xác lỗi sai do thói quen phát âm tiếng Việt để hướng dẫn cách điều chỉnh khẩu hình chi tiết.',
  },
  {
    question: 'Tôi có thể hủy đăng ký gói Pro bất cứ lúc nào không?',
    answer:
      'Có. Bạn có thể tự quản lý và hủy gói dịch vụ bất kỳ lúc nào trong phần Cài đặt tài khoản mà không phát sinh thêm chi phí nào. Ngoài ra, chúng tôi có chính sách cam kết hoàn tiền 100% trong 14 ngày nếu bạn không cảm thấy hiệu quả.',
  },
  {
    question: 'Doanh nghiệp có thể mua gói tài khoản cho nhân viên được không?',
    answer:
      'Có! Gói Doanh Nghiệp cho phép quản trị viên cấp phát tài khoản, tùy chỉnh giáo trình chuyên ngành (IT, Ngân hàng, Y tế, Khách sạn) và theo dõi báo cáo tiến độ học tập hàng tuần của từng nhân viên.',
  },
];
