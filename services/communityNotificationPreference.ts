// Community Chat's notification-mute preference (the bell dropdown in
// ChatPanel.tsx's header). LOCAL ONLY, AND DELIBERATELY SO — same reasoning
// as microphonePreference.ts: this is a preference about one browser on one
// device, not a fact about the account, and this codebase has no
// user-preferences table to put it in / no cross-device sync need for it.
//
// KEYED PER USER, for the same reason microphonePreference.ts is: a shared
// school/family device must not let one student's mute choice silently mute
// the badge for a sibling who logs in on the same browser afterward.
const keyFor = (userId: string) => `engmasterai:community-notifications-muted:${userId}`;

export const readCommunityNotificationsMuted = (userId: string): boolean => {
  if (!userId) return false;
  try {
    return localStorage.getItem(keyFor(userId)) === 'true';
  } catch {
    // Storage can throw in private modes and under some enterprise
    // policies. Defaulting to "not muted" is the safer failure mode — a
    // student never silently misses their badge because of a storage quirk.
    return false;
  }
};

export const writeCommunityNotificationsMuted = (userId: string, muted: boolean): void => {
  if (!userId) return;
  try {
    if (muted) localStorage.setItem(keyFor(userId), 'true');
    else localStorage.removeItem(keyFor(userId));
  } catch {
    // As above — losing the preference on reload is a degradation, not a
    // failure; the in-memory state for this session still works.
  }
};
