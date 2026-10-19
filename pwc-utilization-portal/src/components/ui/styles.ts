/** Appkit 4 field styling: white field, 8px radius, 1px inset border, orange focus ring. */
export const fieldClass =
  "w-full rounded-md bg-container text-heading placeholder:text-disabled shadow-[inset_0_0_0_1px_var(--ap-border-input)] " +
  "transition-shadow hover:shadow-[inset_0_0_0_1px_var(--ap-border)] " +
  "focus:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ap-primary)] focus-visible:rounded-md " +
  "aria-[invalid=true]:shadow-[inset_0_0_0_2px_var(--ap-error)] disabled:cursor-not-allowed disabled:opacity-60";
