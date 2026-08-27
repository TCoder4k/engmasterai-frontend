import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '../../../../i18n/LanguageProvider';
import { AssistantContext } from '../useAssistant';
import type { AssistantContextValue } from '../useAssistant';
import CommunityNotificationBell from './CommunityNotificationBell';

const baseAssistant: AssistantContextValue = {
  activeTool: null,
  openTool: vi.fn(),
  closeTool: vi.fn(),
  toggleTool: vi.fn(),
  launcherRefs: {
    dictionary: { current: null },
    chat: { current: null },
  },
  lessonContext: null,
  pendingHandoff: null,
  handoffToChat: vi.fn(),
  consumeHandoff: vi.fn(),
  communityUnreadCount: 0,
  refreshCommunityUnreadCount: vi.fn(),
  communityNotificationsMuted: false,
  setCommunityNotificationsMuted: vi.fn(),
};

const renderBell = (overrides: Partial<AssistantContextValue> = {}, children: React.ReactNode = null) =>
  render(
    <LanguageProvider>
      <AssistantContext.Provider value={{ ...baseAssistant, ...overrides }}>
        <CommunityNotificationBell />
        {children}
      </AssistantContext.Provider>
    </LanguageProvider>,
  );

afterEach(() => cleanup());

describe('CommunityNotificationBell', () => {
  it('renders a bell icon with an "on" label when notifications are not muted', () => {
    renderBell({ communityNotificationsMuted: false });
    expect(screen.getByRole('button', { name: /notifications on/i })).toBeInTheDocument();
  });

  it('renders a bell-off icon with a "muted" label when muted', () => {
    renderBell({ communityNotificationsMuted: true });
    expect(screen.getByRole('button', { name: /notifications muted/i })).toBeInTheDocument();
  });

  it('opens the dropdown and checks the currently active option', async () => {
    renderBell({ communityNotificationsMuted: false });
    await userEvent.click(screen.getByRole('button', { name: /notifications on/i }));

    expect(screen.getByRole('menuitemradio', { name: /all notifications/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: /turn off notifications/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('selecting "Turn off notifications" mutes and closes the menu', async () => {
    const setMuted = vi.fn();
    renderBell({ communityNotificationsMuted: false, setCommunityNotificationsMuted: setMuted });
    await userEvent.click(screen.getByRole('button', { name: /notifications on/i }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: /turn off notifications/i }));

    expect(setMuted).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('selecting "All notifications" while muted unmutes', async () => {
    const setMuted = vi.fn();
    renderBell({ communityNotificationsMuted: true, setCommunityNotificationsMuted: setMuted });
    await userEvent.click(screen.getByRole('button', { name: /notifications muted/i }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: /all notifications/i }));

    expect(setMuted).toHaveBeenCalledWith(false);
  });

  it('closes on an outside click', async () => {
    renderBell({}, <button type="button">outside</button>);
    await userEvent.click(screen.getByRole('button', { name: /notifications on/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape and restores focus to the bell button', async () => {
    renderBell();
    const button = screen.getByRole('button', { name: /notifications on/i });
    await userEvent.click(button);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('renders nothing outside an AssistantProvider', () => {
    const { container } = render(
      <LanguageProvider>
        <CommunityNotificationBell />
      </LanguageProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
