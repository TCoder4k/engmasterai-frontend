import React from 'react';
import { useAssistant } from './useAssistant';
import { useTranslation } from '../../../i18n/useTranslation';

// Two triggers sharing one corner, Phase B — the mockup's original
// "Dictionary trigger + Engy mascot" pair, which Phase A deferred to a
// single mascot button (Chat didn't exist yet) with a comment promising
// this exact shape once it did. Both share the SAME single-slot
// `activeTool` state (see AssistantBoundary.tsx) — opening either one
// closes the other automatically, no extra code needed for that.
//
// `dictionary-icon.png`/`engy-icon.png` (public/mascot/) are TRANSPARENT
// crops of the source `1.png`/`2.png` — those sources are 1024x1536 opaque
// -white canvases (no alpha channel) where the real icon/badge occupies a
// small fraction of the frame, so a plain tight crop still rendered as a
// visible white rectangle behind the artwork. These two variants had their
// white canvas flood-filled to transparent (background-connected white only
// — the badge's own light interior fill is untouched) and were then
// re-cropped to the opaque content's bounding box; see the crop/removal
// note in the sprint doc. The artwork itself IS the button: no background,
// border, ring, or shell is layered on top — only a focus-visible ring for
// keyboard a11y. Sizes below are starting values meant to be tuned against
// the real app, not fixed constants.
const AssistantLauncher: React.FC = () => {
  const assistant = useAssistant();
  const { t } = useTranslation();

  // Outside the boundary (admin routes, tests) — render nothing rather than
  // crash, matching useGamification's degrade-gracefully convention.
  if (!assistant) return null;

  return (
    <div className="fixed z-40 right-3 sm:right-4 lg:right-7 bottom-20 lg:bottom-6 flex flex-col items-center gap-2.5">
      <button
        ref={assistant.launcherRefs.dictionary}
        type="button"
        onClick={() => assistant.toggleTool('dictionary')}
        aria-label={t.assistant.openDictionary}
        aria-haspopup="dialog"
        aria-expanded={assistant.activeTool === 'dictionary'}
        className="w-[46px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded-lg"
      >
        <img
          src="/mascot/dictionary-icon.png"
          alt=""
          aria-hidden="true"
          className="w-full h-auto object-contain select-none pointer-events-none"
        />
      </button>
      <button
        ref={assistant.launcherRefs.chat}
        type="button"
        onClick={() => assistant.toggleTool('chat')}
        aria-label={t.assistant.openLauncher}
        aria-haspopup="dialog"
        aria-expanded={assistant.activeTool === 'chat'}
        className="w-[58px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded-full"
      >
        <img
          src="/mascot/engy-icon.png"
          alt=""
          aria-hidden="true"
          className="w-full h-auto object-contain select-none pointer-events-none"
        />
      </button>
    </div>
  );
};

export default AssistantLauncher;
