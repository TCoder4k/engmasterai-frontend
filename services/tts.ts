// Text-to-speech via the browser's native Web Speech API. No network call,
// no auth surface, no dependency — safe to use from any practice component.
//
// Fallback discipline (Sprint 03A, locked by design review):
//  - Never assume an en-US (or en-GB) voice exists on the device; fall back
//    to ANY available English-language voice before giving up on voice
//    selection.
//  - If speechSynthesis isn't supported at all, callers must render an
//    explicit "not supported" state — speakText() reports this via its
//    return value, never a silent no-op.
//  - Browser TTS output is a listening-practice aid, never a canonical
//    pronunciation reference for any future scoring feature.
//  - Callers must only invoke speakText() from an explicit user gesture
//    (e.g. a play-button click) — never from a mount/segment-change effect,
//    per browser autoplay-restriction policy.

export interface SpeakOptions {
  rate?: number;
  accent?: 'US' | 'UK';
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

export const isTtsSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

// Returns false (and calls nothing) when TTS is unsupported, so callers can
// distinguish "not supported" from "spoke successfully."
export const speakText = (text: string, options: SpeakOptions = {}): boolean => {
  if (!isTtsSupported()) return false;

  const { rate = 1.0, accent = 'US', onStart, onEnd, onError } = options;
  const targetLang = accent === 'UK' ? 'en-GB' : 'en-US';

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1.0;
  utterance.lang = targetLang;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const exactAccentMatch = voices.find((voice) => voice.lang.startsWith(targetLang));
    const anyEnglishVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('en'));
    const matchedVoice = exactAccentMatch || anyEnglishVoice;
    if (matchedVoice) {
      utterance.voice = matchedVoice;
      utterance.lang = matchedVoice.lang;
    }
  }

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  if (onError) utterance.onerror = onError;

  window.speechSynthesis.speak(utterance);
  return true;
};

export const cancelSpeech = (): void => {
  if (isTtsSupported()) {
    window.speechSynthesis.cancel();
  }
};
