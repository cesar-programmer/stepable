// Loaded after the first render by MotionProvider (LazyMotion), so pages
// do not pay for animation features before they are interactive.
import { domMax } from "motion/react";

export default domMax;
