"use client";

import {
  createContext,
  useActionState,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  askAssistantAction,
  type AssistantState,
} from "@/app/spaces/[spaceId]/assistant/actions";
import {
  askStepHelpAction,
  type StepHelpState,
} from "@/app/spaces/[spaceId]/routes/[routeId]/learn/actions";

/** The step a learner is looking at, registered by its help launcher. */
export type StepContext = {
  routeId: string;
  stepId: string;
  position: number;
  title: string;
  resolved: boolean;
};

export type ConsultScope = "espacio" | "paso";

export type ConsultSession<S extends { kind: string }> = {
  state: S;
  formAction: (formData: FormData) => void;
  pending: boolean;
  question: string;
  setQuestion: (value: string) => void;
  /** What was sent, shown while the answer is on its way. */
  pendingQuestion: string;
  /** Changes with every new result, for the shared swap transition. */
  resultCount: number;
  /** False when the last result belongs to another step (help only). */
  resultVisible: boolean;
  markSubmitted: (question: string) => void;
};

/**
 * One independent query at a time. The state lives in memory only, in the
 * space frame: it survives closing the panel and navigating inside the
 * space, and disappears with the frame (another space, or signing out).
 */
function useConsultSession<S extends { kind: string }>(
  action: (previous: S, formData: FormData) => Promise<S>,
) {
  const [state, formAction, pending] = useActionState<S, FormData>(action, {
    kind: "idle",
  } as Awaited<S>);
  const [question, setQuestion] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [seenState, setSeenState] = useState(state);
  const [resultCount, setResultCount] = useState(0);

  // A new result: clear the field only after an answer, so a failed query
  // keeps what was written.
  if (state !== seenState) {
    setSeenState(state);
    setResultCount((count) => count + 1);
    if (state.kind === "answered") setQuestion("");
  }

  return {
    state,
    formAction,
    pending,
    question,
    setQuestion,
    pendingQuestion,
    resultCount,
    setPendingQuestion,
  };
}

type AssistantContextValue = {
  spaceId: string;
  open: boolean;
  /** The scope shown: "paso" only while a step is registered. */
  scope: ConsultScope;
  step: StepContext | null;
  openPanel: (scope: ConsultScope, opener?: HTMLElement | null) => void;
  closePanel: () => void;
  setScope: (scope: ConsultScope) => void;
  space: ConsultSession<AssistantState>;
  help: ConsultSession<StepHelpState>;
  registerStep: (step: StepContext) => void;
  unregisterStep: (stepId: string) => void;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistant() {
  const value = useContext(AssistantContext);
  if (!value) throw new Error("useAssistant needs an AssistantProvider");
  return value;
}

/** For components that also render outside a space (they do nothing). */
export function useOptionalAssistant() {
  return useContext(AssistantContext);
}

export function AssistantProvider({
  spaceId,
  children,
}: {
  spaceId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [requestedScope, setRequestedScope] = useState<ConsultScope>("espacio");
  const [step, setStep] = useState<StepContext | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const space = useConsultSession<AssistantState>(askAssistantAction);
  const help = useConsultSession<StepHelpState>(askStepHelpAction);
  // The step each help result was asked for: another step never shows it.
  const [helpFor, setHelpFor] = useState<string | null>(null);
  const [helpStepId, setHelpStepId] = useState<string | null>(null);
  if ((step?.stepId ?? null) !== helpStepId) {
    setHelpStepId(step?.stepId ?? null);
    setHelpFor(null);
    help.setQuestion("");
  }

  const registerStep = useCallback((next: StepContext) => {
    setStep((current) =>
      current &&
      current.stepId === next.stepId &&
      current.resolved === next.resolved &&
      current.title === next.title &&
      current.position === next.position &&
      current.routeId === next.routeId
        ? current
        : next,
    );
  }, []);
  // A leaving step (still animating out) never unregisters the new one.
  const unregisterStep = useCallback((stepId: string) => {
    setStep((current) => (current?.stepId === stepId ? null : current));
  }, []);

  const openPanel = useCallback(
    (scope: ConsultScope, from?: HTMLElement | null) => {
      opener.current = from ?? null;
      setRequestedScope(scope);
      setOpen(true);
    },
    [],
  );
  const closePanel = useCallback(() => {
    setOpen(false);
    const target = opener.current;
    opener.current = null;
    const fromHelp = Boolean(target?.closest(".help-launcher"));
    // Back to what opened the panel; if it left with its step, to the
    // current step's launcher, or else to the floating button.
    requestAnimationFrame(() => {
      if (target?.isConnected && !target.closest("[data-exiting]")) {
        target.focus();
        return;
      }
      const fallback = fromHelp
        ? document.querySelector<HTMLElement>(
            ".help-launcher button:not([data-exiting] *)",
          )
        : null;
      (
        fallback ?? document.querySelector<HTMLElement>(".assistant-fab")
      )?.focus();
    });
  }, []);

  const value = useMemo<AssistantContextValue>(
    () => ({
      spaceId,
      open,
      scope: requestedScope === "paso" && step ? "paso" : "espacio",
      step,
      openPanel,
      closePanel,
      setScope: setRequestedScope,
      space: {
        ...space,
        resultVisible: true,
        markSubmitted: space.setPendingQuestion,
      },
      help: {
        ...help,
        resultVisible: helpFor !== null && helpFor === step?.stepId,
        markSubmitted: (question: string) => {
          help.setPendingQuestion(question);
          setHelpFor(step?.stepId ?? null);
        },
      },
      registerStep,
      unregisterStep,
    }),
    [
      spaceId,
      open,
      requestedScope,
      step,
      openPanel,
      closePanel,
      space,
      help,
      helpFor,
      registerStep,
      unregisterStep,
    ],
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}
