
export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  progress: number;
  totalLessons: number;
  completedLessons: number;
}

export interface User {
  name: string;
  avatar: string;
  level: number;
  currentExp: number;
  nextLevelExp: number;
  certificatesCount: number;
}

export interface NavItem {
  label: string;
  href: string;
  isActive?: boolean;
}

export const COURSES: Course[] = [
  {
    id: '1',
    title: 'Ngữ Pháp Cơ Bản',
    description: 'Nắm vững các kiến thức ngữ pháp cơ bản trong tiếng Anh.',
    thumbnail: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&q=80&w=200&h=200',
    progress: 65,
    totalLessons: 1136,
    completedLessons: 750,
  },
  {
    id: '2',
    title: '1000 Từ Vựng Tiếng Anh Cơ Bản',
    description: 'Ghi nhớ nhanh hơn 1000 từ vựng cơ bản thông qua các game tương tác.',
    thumbnail: 'https://images.unsplash.com/photo-1523240715632-d984bb4b9106?auto=format&fit=crop&q=80&w=200&h=200',
    progress: 66,
    totalLessons: 5746,
    completedLessons: 3838,
  },
  {
    id: '3',
    title: 'Tiếng Anh giao tiếp cơ bản',
    description: 'Giao tiếp từ cơ bản đến nâng cao qua 60 tình huống thường gặp trong đời sống.',
    thumbnail: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=200&h=200',
    progress: 30,
    totalLessons: 100,
    completedLessons: 30,
  }
];

export const NAV_ITEMS: NavItem[] = [
  { label: 'Tiếng Anh online', href: '#', isActive: true },
  { label: 'Lộ trình', href: '#' },
  { label: 'Học qua video', href: '#' },
  { label: 'Group Facebook', href: '#' },
];
