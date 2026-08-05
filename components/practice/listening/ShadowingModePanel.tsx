import React from 'react';
import { Mic } from 'lucide-react';
import EmptyState from '../../shared/EmptyState';
import { useTranslation } from '../../../i18n/useTranslation';

// Sprint 11 Phase 2 — a deliberate placeholder, and it says so plainly.
//
// The route exists because a recording may legitimately enable SHADOWING (an
// admin can already tick it), and 404-ing a mode the content genuinely
// supports would be a lie in the other direction. What does NOT exist yet is
// recording (Phase 3), speech recognition and scoring (Phase 4B) — so this
// panel offers nothing that pretends to evaluate a student.
//
// The sentence list and the player above remain fully usable here: listening
// to a sentence on repeat and reading along is real practice, and it is the
// honest subset of shadowing that works with no microphone at all.
const ShadowingModePanel: React.FC = () => {
  const { t } = useTranslation();
  return (
    <EmptyState icon={<Mic size={32} />} message={t.practice.shadowingComingSoon} />
  );
};

export default ShadowingModePanel;
