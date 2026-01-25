
export interface AdminStat {
  label: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down';
  icon: 'users' | 'revenue' | 'courses' | 'award' | 'clock' | 'level';
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'Học viên' | 'Giảng viên' | 'Admin';
  status: 'Hoạt động' | 'Bị khóa';
  currentLevel: number;
  joinDate: string;
}

export interface ManagedCourse {
  id: string;
  title: string;
  instructor: string;
  category: string;
  students: number;
  price: string;
  status: 'Công khai' | 'Bản nháp';
}

export const STATS: AdminStat[] = [
  { label: 'Tổng Học Viên', value: '18,245', change: 14.2, trend: 'up', icon: 'users' },
  { label: 'Cấp độ trung bình', value: '18.4', change: 3.2, trend: 'up', icon: 'level' },
  { label: 'Thời gian học/ngày', value: '42m', change: 8.5, trend: 'up', icon: 'clock' },
  { label: 'Tỷ lệ hoàn thành bài tập', value: '82.1%', change: 1.4, trend: 'down', icon: 'award' },
];

export const RECENT_LEARNERS: ManagedUser[] = [
  { id: '1', name: 'Lê Văn Nam', email: 'nam.le@gmail.com', avatar: 'https://picsum.photos/seed/learn1/100/100', role: 'Học viên', status: 'Hoạt động', currentLevel: 42, joinDate: '12/10/2024' },
  { id: '2', name: 'Trần Thị Thu', email: 'thutran@outlook.com', avatar: 'https://picsum.photos/seed/learn2/100/100', role: 'Học viên', status: 'Hoạt động', currentLevel: 15, joinDate: '10/10/2024' },
  { id: '3', name: 'Nguyễn Minh Anh', email: 'minhanh.ng@edu.vn', avatar: 'https://picsum.photos/seed/learn3/100/100', role: 'Học viên', status: 'Hoạt động', currentLevel: 29, joinDate: '08/10/2024' },
  { id: '4', name: 'Hoàng Quốc Việt', email: 'viet.hq@tech.co', avatar: 'https://picsum.photos/seed/learn4/100/100', role: 'Học viên', status: 'Bị khóa', currentLevel: 3, joinDate: '05/10/2024' },
];

export const POPULAR_COURSES: ManagedCourse[] = [
  { id: 'C1', title: 'IELTS Breakthrough', instructor: 'Dr. Sarah', category: 'Luyện thi', students: 2450, price: '2.5M ₫', status: 'Công khai' },
  { id: 'C2', title: 'English for Engineers', instructor: 'Kevin Moore', category: 'Chuyên ngành', students: 1120, price: '1.8M ₫', status: 'Công khai' },
  { id: 'C3', title: 'Pronunciation Master', instructor: 'Coach', category: 'Giao tiếp', students: 890, price: '990K ₫', status: 'Bản nháp' },
];
