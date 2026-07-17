
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

export const NAV_ITEMS: NavItem[] = [
  { label: 'Tiếng Anh online', href: '#', isActive: true },
  { label: 'Lộ trình', href: '#' },
  { label: 'Học qua video', href: '#' },
  { label: 'Group Facebook', href: '#' },
];
