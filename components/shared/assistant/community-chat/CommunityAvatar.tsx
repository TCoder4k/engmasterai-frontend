import React from 'react';

interface CommunityAvatarProps {
  name: string;
  avatarUrl: string | null;
  size?: number;
}

// Mirrors AvatarMenu.tsx's own avatar treatment (gradient circle + initial
// fallback) rather than inventing a new look — User.avatarUrl is genuinely
// nullable, so a real fallback (not just an empty circle) is required, not
// an edge case to skip.
const getInitial = (name: string): string => name?.charAt(0)?.toUpperCase() || 'U';

const CommunityAvatar: React.FC<CommunityAvatarProps> = ({ name, avatarUrl, size = 32 }) => (
  <div
    className="rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0"
    style={{ width: size, height: size }}
  >
    {avatarUrl ? (
      <img src={avatarUrl} alt="" aria-hidden="true" className="w-full h-full object-cover" />
    ) : (
      <span className="text-white font-bold text-sm" aria-hidden="true">
        {getInitial(name)}
      </span>
    )}
  </div>
);

export default CommunityAvatar;
