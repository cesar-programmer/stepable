"use client";

import {
  AnimatePresence,
  LazyMotion,
  m,
  MotionConfig,
  useIsPresent,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { useLinkStatus } from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";

/**
 * Shared motion vocabulary. Same values as the CSS tokens in styles.css
 * ("Motion system"): CSS animates simple effects, these components animate
 * state changes. Screens use the components, never their own timings.
 */
export const motionTokens = {
  instant: 0.09,
  fast: 0.14,
  medium: 0.22,
  slow: 0.32,
  easeOut: [0.2, 0.7, 0.2, 1] as const,
  easeIn: [0.4, 0, 1, 1] as const,
};

const enter: Transition = {
  duration: motionTokens.medium,
  ease: motionTokens.easeOut,
};
const leave: Transition = {
  duration: motionTokens.fast,
  ease: motionTokens.easeIn,
};
const instant: Transition = { duration: 0 };

/** Enter and leave transitions, or none at all with reduced motion. */
function useTransitions() {
  const reduced = useReducedMotion();
  return reduced
    ? { enter: instant, leave: instant, reduced: true }
    : { enter, leave, reduced: false };
}

/**
 * Root provider: loads the animation features lazily (`m` components stay
 * small) and follows the user's reduced-motion setting.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion
      features={() => import("./motion-features").then((mod) => mod.default)}
      strict
    >
      <MotionConfig reducedMotion="user" transition={enter}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

/**
 * Content that is leaving stays visible for its exit animation only. While
 * it leaves it is inert and its controls are disabled, so it can neither
 * take focus nor be submitted with a form.
 */
function ExitGuard({ children }: { children: ReactNode }) {
  const present = useIsPresent();
  return (
    <fieldset
      aria-hidden={present ? undefined : true}
      className="motion-guard"
      data-exiting={present ? undefined : ""}
      disabled={!present}
      inert={!present}
      role="none"
    >
      {children}
    </fieldset>
  );
}

/**
 * Conditional content (fields, notices, a chosen file) that opens and
 * closes in height, so the content below moves instead of jumping. What
 * was already shown on the first render does not animate.
 */
export function Presence({
  show,
  children,
  className,
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { enter, leave } = useTransitions();
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <m.div
          animate={{
            height: "auto",
            opacity: 1,
            transitionEnd: { overflow: "visible" },
          }}
          className={className}
          exit={{
            height: 0,
            opacity: 0,
            overflow: "hidden",
            transition: leave,
          }}
          initial={{ height: 0, opacity: 0, overflow: "hidden" }}
          key="presence"
          transition={enter}
        >
          <ExitGuard>{children}</ExitGuard>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Swaps one state for another (a step, an activity type, the assistant's
 * initial, loading, result and error states). The new content enters while
 * the old one leaves on top of it: nothing waits for the exit. With
 * `order` (a step position) it slides forward or back; without it, it only
 * fades. When the swap takes focus
 * away (it was inside the old content), focus moves to the new content.
 */
export function SwapTransition({
  swapKey,
  order,
  children,
  className,
}: {
  swapKey: string;
  order?: number;
  children: ReactNode;
  className?: string;
}) {
  const { enter, leave, reduced } = useTransitions();
  // Direction of the last change, derived from the order of both keys.
  const [shown, setShown] = useState({ key: swapKey, order, direction: 0 });
  if (shown.key !== swapKey) {
    setShown({
      key: swapKey,
      order,
      direction:
        order !== undefined && shown.order !== undefined
          ? Math.sign(order - shown.order)
          : 0,
    });
  }
  const offset = reduced ? 0 : 16 * shown.direction;
  const container = useRef<HTMLDivElement>(null);
  const previousKey = useRef(swapKey);

  useEffect(() => {
    if (previousKey.current === swapKey) return;
    previousKey.current = swapKey;
    const active = document.activeElement;
    if (
      !active ||
      active === document.body ||
      active.closest("[data-exiting]")
    ) {
      container.current
        ?.querySelector<HTMLElement>(
          ":scope > .swap-item:has(> .motion-guard:not([data-exiting]))",
        )
        ?.focus({ preventScroll: true });
    }
  }, [swapKey]);

  return (
    <div className={`swap${className ? ` ${className}` : ""}`} ref={container}>
      <AnimatePresence initial={false} mode="popLayout">
        <m.div
          animate={{ opacity: 1, x: 0 }}
          className="swap-item"
          exit={{ opacity: 0, x: -offset, transition: leave }}
          initial={{ opacity: 0, x: offset }}
          key={swapKey}
          tabIndex={-1}
          transition={enter}
        >
          <ExitGuard>{children}</ExitGuard>
        </m.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * A panel that slides in from the right (side panel) or from the bottom
 * (sheet). It opens and closes only from real state; while closing its
 * content is inert. With reduced motion it only fades.
 */
export function SlideOver({
  open,
  from,
  className,
  children,
}: {
  open: boolean;
  from: "right" | "bottom";
  className?: string;
  children: ReactNode;
}) {
  const { enter, leave, reduced } = useTransitions();
  const hidden = reduced
    ? { opacity: 0 }
    : from === "right"
      ? { x: "100%" }
      : { y: "100%" };
  return (
    <AnimatePresence>
      {open ? (
        <m.div
          animate={{ x: 0, y: 0, opacity: 1 }}
          className={className}
          exit={{ ...hidden, transition: leave }}
          initial={hidden}
          key={from}
          transition={{ ...enter, duration: reduced ? 0 : motionTokens.slow }}
        >
          <ExitGuard>{children}</ExitGuard>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * A list whose items enter, leave and make room (added, removed or
 * filtered rows). A leaving item fades out; the rest then slide into place
 * with a layout animation. Items must be `AnimatedItem`s with a stable key;
 * those present on the first render do not animate.
 */
export function AnimatedList({
  as: Tag = "ul",
  className,
  children,
}: {
  as?: "ul" | "ol" | "div";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={className}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </Tag>
  );
}

export function AnimatedItem({
  as = "li",
  className,
  children,
  id,
}: {
  as?: "li" | "div";
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  const { enter, leave, reduced } = useTransitions();
  const Component: ElementType = as === "li" ? m.li : m.div;
  return (
    <Component
      animate={{ opacity: 1, y: 0 }}
      className={className}
      exit={{ opacity: 0, transition: leave }}
      id={id}
      initial={{ opacity: 0, y: reduced ? 0 : 4 }}
      layout={reduced ? false : "position"}
      transition={enter}
    >
      {children}
    </Component>
  );
}

/**
 * Place inside a next/link: marks the link while its navigation is in
 * flight, so the click is acknowledged at once without delaying anything.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className="link-pending"
      data-pending={pending || undefined}
    />
  );
}
