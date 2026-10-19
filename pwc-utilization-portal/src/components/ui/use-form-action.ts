"use client";

import { useActionState, useRef, startTransition } from "react";
import type { FormState } from "@/lib/validation";

/**
 * Runs a Server Action from a form without React 19's automatic form reset,
 * so a validation error never wipes what the user typed. The form is only
 * reset (optionally) after a successful save.
 */
export function useFormAction<S extends FormState>(
  action: (prev: S, formData: FormData) => Promise<S>,
  options: { resetOnSuccess?: boolean; onSuccess?: (state: S) => void } = {},
) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, dispatch, pending] = useActionState<S, FormData>(async (prev, formData) => {
    const next = await action(prev as S, formData);
    if (next.ok) {
      if (options.resetOnSuccess) formRef.current?.reset();
      options.onSuccess?.(next);
    }
    return next;
  }, {} as Awaited<S>);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(formData));
  }

  return { state, pending, formRef, onSubmit };
}
