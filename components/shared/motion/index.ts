// Sprint 06B.5 — the single entry point for motion in this app.
//
// Framer Motion enters the codebase HERE and nowhere else. Feature modules
// import these primitives rather than `framer-motion` directly, so timing
// and easing stay one system instead of each module growing its own
// animation dialect — the reason the dependency was worth adopting at all.
export { default as FadeIn } from './FadeIn';
export { default as SlideUp } from './SlideUp';
export { default as SlideLeft } from './SlideLeft';
export { default as ScaleIn } from './ScaleIn';
export {
  default as StaggerContainer,
  StaggerItem,
} from './StaggerContainer';
export { default as AnimatedCounter } from './AnimatedCounter';
export * from './tokens';
