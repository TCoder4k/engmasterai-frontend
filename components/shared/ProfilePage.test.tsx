import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import ProfilePage from './ProfilePage';
import * as userService from '../../services/userService';
import * as authServiceModule from '../../services/authService';


describe('ProfilePage 60/40 UI Refactor', () => {
  const mockUser = {
    id: 'user-1',
    name: 'Tà đạo',
    email: 'tucaqn1@gmail.com',
    role: 'USER',
    avatarUrl: 'https://example.com/avatar.jpg',
    isPro: false,
    proExpiresAt: null,
  };

  beforeEach(() => {
    localStorage.setItem('language', 'vi');
    vi.spyOn(authServiceModule.authService, 'getUser').mockReturnValue(mockUser as any);
    vi.spyOn(userService, 'getProfile').mockResolvedValue(mockUser as any);
    vi.spyOn(userService, 'updateProfile').mockResolvedValue({
      ...mockUser,
      name: 'Tà đạo updated',
    } as any);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const renderProfilePage = () => {
    return render(
      <MemoryRouter initialEntries={['/profile']}>
        <LanguageProvider>
          <ProfilePage />
        </LanguageProvider>
      </MemoryRouter>
    );
  };

  it('renders header inside max-w-[1400px] container with title, subtitle, and logo', async () => {
    renderProfilePage();

    expect(await screen.findByText('Thông tin tài khoản')).toBeInTheDocument();
    expect(screen.getByText('Quản lý hồ sơ cá nhân của bạn')).toBeInTheDocument();
    expect(screen.getByText('Engmaster')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('renders personal information card and profile details', async () => {
    renderProfilePage();

    expect(await screen.findByText('Tà đạo')).toBeInTheDocument();
    expect(screen.getByText('tucaqn1@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Học viên')).toBeInTheDocument();
    expect(screen.getByText('Thông tin cá nhân')).toBeInTheDocument();
    expect(screen.getByText('Cập nhật thông tin cá nhân của bạn')).toBeInTheDocument();
  });

  it('allows updating display name and submits to userService', async () => {
    const user = userEvent.setup();
    renderProfilePage();

    const nameInput = (await screen.findByPlaceholderText('Nhập tên hiển thị')) as HTMLInputElement;
    expect(nameInput.value).toBe('Tà đạo');

    await user.clear(nameInput);
    await user.type(nameInput, 'Tà đạo updated');

    const saveButton = screen.getByRole('button', { name: /Lưu thay đổi/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(userService.updateProfile).toHaveBeenCalledWith({ name: 'Tà đạo updated' });
    });
  });



  it('renders footer at the bottom of the page', async () => {
    renderProfilePage();

    expect(
      await screen.findByText(/© 2024 EngmasterAI. Cùng bạn chinh phục tiếng Anh mỗi ngày!/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Điều khoản')).toBeInTheDocument();
    expect(screen.getByText('Bảo mật')).toBeInTheDocument();
    expect(screen.getByText('Liên hệ')).toBeInTheDocument();
  });
});
