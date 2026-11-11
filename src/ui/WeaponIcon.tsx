import type { ReactNode } from 'react';
import type { WeaponId } from '../game/types';

export type WeaponIconId = WeaponId | 'rope';

/**
 * Inline weapon art for the HUD and the briefing arsenal. SVG keeps the cards
 * sharp at every DPR without an asset pipeline.
 */
export function WeaponIcon({ id, className = 'weapon-glyph' }: { id: WeaponIconId; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {ART[id]}
    </svg>
  );
}

const ART: Record<WeaponIconId, ReactNode> = {
  bazooka: (
    <g transform="rotate(-38 16 16)">
      <rect x="3" y="13" width="23" height="7" rx="3" fill="#4b5b50" stroke="#0c1412" strokeWidth="1.2" />
      <rect x="5" y="14" width="16" height="2" rx="1" fill="#71836f" opacity="0.7" />
      <rect x="1.5" y="12.5" width="3.5" height="8" rx="1.5" fill="#2c3833" />
      <rect x="19" y="11.5" width="3" height="10" rx="1" fill="#e8ad68" />
      <rect x="25.5" y="12.5" width="3" height="8" rx="1" fill="#2c3833" />
      <path d="M28.5 13 32 16l-3.5 3Z" fill="#ffd166" />
      <path d="M28.5 14.6 30.6 16l-2.1 1.4Z" fill="#ff8a5b" />
      <rect x="10" y="10.5" width="2" height="3" rx="0.6" fill="#93a48e" />
      <rect x="13" y="10.5" width="2" height="3" rx="0.6" fill="#93a48e" />
      <path d="M11 20h3l1 4h-3Z" fill="#2c3833" />
    </g>
  ),
  grenade: (
    <>
      <path
        d="M16 7c-5 0-8 3.5-8 8.5C8 21 11.5 26 16 26s8-5 8-10.5C24 10.5 21 7 16 7Z"
        fill="#6f8a52"
        stroke="#0e1710"
        strokeWidth="1.3"
      />
      <path d="M12 10.5c1 1 2.5 1.5 4 1.5s3-.5 4-1.5" fill="none" stroke="#b9cc8b" strokeWidth="1.4" opacity="0.8" />
      <path d="M9.5 15.5h13M10 19.5h12M12 23.5h8" stroke="#465a33" strokeWidth="1" />
      <rect x="13.5" y="4" width="5" height="3.5" rx="1" fill="#9db06f" stroke="#0e1710" />
      <path d="M19 5.5c2.5-.5 4.5.5 5 2.5" fill="none" stroke="#c9b183" strokeWidth="1.4" />
      <circle cx="24.5" cy="9" r="1.6" fill="none" stroke="#e8ad68" strokeWidth="1.2" />
      <circle cx="13" cy="14" r="1.2" fill="#cfe0a2" opacity="0.8" />
    </>
  ),
  shotgun: (
    <g transform="rotate(-30 16 16)">
      <path d="M1 13.5 7 12v8l-6-1.5c-1.2-1.5-1.2-3.5 0-5Z" fill="#7d5a34" stroke="#0c1110" strokeWidth="1.2" />
      <rect x="7" y="12" width="5" height="8" rx="1" fill="#3b4a44" stroke="#0c1110" strokeWidth="1.1" />
      <rect x="12" y="12" width="15" height="3" rx="1.5" fill="#2e3a38" stroke="#0c1110" strokeWidth="1.1" />
      <rect x="12" y="16.5" width="15" height="3" rx="1.5" fill="#2e3a38" stroke="#0c1110" strokeWidth="1.1" />
      <rect x="17" y="11" width="7" height="10" rx="2" fill="#8a5a34" stroke="#0c1110" strokeWidth="1.1" />
      <path d="M19 13v6M22 13v6" stroke="#5e3d22" strokeWidth="1" />
      <rect x="24" y="11.5" width="2" height="9.5" fill="#e8ad68" />
      <circle cx="27.5" cy="13.5" r="0.9" fill="#080d0c" />
      <circle cx="27.5" cy="18" r="0.9" fill="#080d0c" />
      <path d="M11 20.5q2 3 4 0" fill="none" stroke="#c9b183" strokeWidth="1.2" />
      <path d="M12.5 20v2" stroke="#c9b183" strokeWidth="1.2" />
    </g>
  ),
  dynamite: (
    <>
      <circle cx="17.5" cy="4.5" r="3.6" fill="#ff8a5b" opacity="0.35" />
      <rect
        x="6.5"
        y="13"
        width="5.5"
        height="15"
        rx="2.5"
        fill="#a94c34"
        stroke="#140d0a"
        strokeWidth="1.1"
        transform="rotate(-9 9.25 20.5)"
      />
      <rect x="13.2" y="10.5" width="5.6" height="18" rx="2.6" fill="#cf6a49" stroke="#140d0a" strokeWidth="1.1" />
      <rect
        x="20"
        y="13"
        width="5.5"
        height="15"
        rx="2.5"
        fill="#b4553a"
        stroke="#140d0a"
        strokeWidth="1.1"
        transform="rotate(9 22.75 20.5)"
      />
      <rect x="5.5" y="17" width="21" height="3.4" rx="1.7" fill="#d9c9a8" stroke="#3a2a20" strokeWidth="0.9" />
      <rect x="5.5" y="19" width="21" height="1.4" fill="#b9a582" />
      <path d="M16 10.5c0-2.5 2-3 1.5-5.5" fill="none" stroke="#c9b183" strokeWidth="1.6" />
      <circle cx="17.5" cy="4.5" r="1.8" fill="#ffd166" />
    </>
  ),
  rope: (
    <>
      <path d="M16 13.5V4" stroke="#d8a45f" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="16" cy="4" r="2.2" fill="#2e3a38" stroke="#c9b183" strokeWidth="1.2" />
      <circle cx="16" cy="20" r="6.5" fill="none" stroke="#d8a45f" strokeWidth="2.8" />
      <circle cx="16" cy="20" r="6.5" fill="none" stroke="#f0c98c" strokeWidth="0.9" strokeDasharray="1 2.4" opacity="0.8" />
      <path d="M16 13.5c-2 0-3.5 1-4.5 2.5" fill="none" stroke="#b9834a" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
};
