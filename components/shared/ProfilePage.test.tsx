import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import ProfilePage from './ProfilePage';
import * as userService from '../../services/userService';
import * as authServiceModule from '../../services/authService';
import * as referralService from '../../services/referralService';

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
    vi.spyOn(referralService, 'getMyReferralCode').mockResolvedValue({
      code: 'F_5wU-zu',
    });
    vi.spyOn(referralService, 'redeemReferralCode').mockResolvedValue(undefined);
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

  it('renders two-column 60/40 grid layout with Personal Information and Referral Card', async () => {
    const { container } = renderProfilePage();

    // Verify 60/40 grid classes on main grid
    const main = container.querySelector('main');
    const grid = main?.firstElementChild;
    expect(grid?.className).toContain('lg:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]');

    // Left 60%: single continuous card with banner and form
    expect(await screen.findByText('Tà đạo')).toBeInTheDocument();
    expect(screen.getByText('tucaqn1@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Học viên')).toBeInTheDocument();
    expect(screen.getByText('Thông tin cá nhân')).toBeInTheDocument();
    expect(screen.getByText('Cập nhật thông tin cá nhân của bạn')).toBeInTheDocument();

    // Right 40%: Referral card
    expect(screen.getByText('Mời bạn học cùng')).toBeInTheDocument();
    expect(screen.getByText('MÃ CỦA BẠN')).toBeInTheDocument();
    expect(await screen.findByText('F_5wU-zu')).toBeInTheDocument();
    expect(screen.getByText('CÓ MÃ CỦA BẠN BÈ?')).toBeInTheDocument();
    expect(screen.getByText('Học cùng bạn bè vui hơn mỗi ngày!')).toBeInTheDocument();
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

  it('allows copying referral code and redeeming a friend code', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    renderProfilePage();

    const copyButton = await screen.findByRole('button', { name: /Sao chép/i });
    await user.click(copyButton);

    expect(writeTextMock).toHaveBeenCalledWith('F_5wU-zu');
    expect(await screen.findByText('Đã chép')).toBeInTheDocument();

    const friendInput = screen.getByPlaceholderText('Nhập mã giới thiệu');
    await user.type(friendInput, 'FRIEND123');

    const redeemButton = screen.getByRole('button', { name: /Dùng mã/i });
    await user.click(redeemButton);

    await waitFor(() => {
      expect(referralService.redeemReferralCode).toHaveBeenCalledWith('FRIEND123');
    });
    expect(await screen.findByText(/Đã áp dụng mã!/i)).toBeInTheDocument();
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
