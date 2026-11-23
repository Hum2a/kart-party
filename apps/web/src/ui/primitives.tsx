import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type Ref,
} from "react";
import { Link, type LinkProps } from "react-router";

type Variant = "primary" | "secondary" | "danger";

function buttonClasses(variant: Variant, className: string) {
  const tone =
    variant === "primary"
      ? "bg-accent text-accent-foreground"
      : variant === "danger"
        ? "border border-highlight bg-highlight text-highlight-foreground"
        : "border border-line bg-background text-foreground";
  return `motion-press skin-control inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 px-5 text-lg font-bold disabled:cursor-not-allowed disabled:opacity-60 ${tone} ${className}`;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: LinkProps & { variant?: Variant }) {
  return <Link className={buttonClasses(variant, className)} {...props} />;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  ref?: Ref<HTMLButtonElement>;
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, className)} {...props} />
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({
  label,
  hint,
  error,
  id,
  className = "",
  ...props
}: TextFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const describedBy = [hint ? `${fieldId}-hint` : "", error ? `${fieldId}-error` : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label
        htmlFor={fieldId}
        className="text-sm font-bold uppercase tracking-wide text-muted"
      >
        {label}
      </label>
      <input
        id={fieldId}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        className="skin-control min-h-12 border border-line bg-background px-4 text-lg text-foreground transition-colors duration-150 focus:border-highlight"
        {...props}
      />
      {hint ? (
        <p id={`${fieldId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${fieldId}-error`}
          role="alert"
          className="text-sm font-bold text-accent"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A row of mutually exclusive choices, as radio buttons styled as segments. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; note?: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="grid gap-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-sm font-bold uppercase tracking-wide text-muted">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={String(option.value)}
            className="motion-press skin-control flex min-h-11 cursor-pointer touch-manipulation items-center gap-2 border border-line px-4 font-bold has-checked:border-accent has-checked:bg-accent has-checked:text-accent-foreground has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
            {option.note ? (
              <span className="text-xs font-normal opacity-80">{option.note}</span>
            ) : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
