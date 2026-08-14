import * as React from "react";
import { cn } from "@/lib/utils";

const BASE =
  "w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 " +
  "dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-800";

function bordaPorErro(erro?: boolean) {
  return erro
    ? "border-red-500 focus:ring-red-500"
    : "border-slate-300 dark:border-slate-700";
}

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  erro?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, erro, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      aria-invalid={erro || undefined}
      className={cn(
        BASE,
        bordaPorErro(erro),
        type === "file"
          ? "h-auto min-h-10 py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
          : "h-10",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  erro?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, erro, children, ...props }, ref) => (
    <select
      ref={ref}
      aria-invalid={erro || undefined}
      className={cn(BASE, bordaPorErro(erro), "h-10", className)}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { erro?: boolean }
>(({ className, erro, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={erro || undefined}
    className={cn(BASE, bordaPorErro(erro), "min-h-20", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Campo({
  label,
  erro,
  obrigatorio,
  dica,
  children,
}: {
  label: string;
  erro?: string;
  obrigatorio?: boolean;
  dica?: string;
  children: React.ReactNode;
}) {
  const gerado = React.useId();
  const erroId = `${gerado}-erro`;
  const dicaId = `${gerado}-dica`;
  let campoId = gerado;

  const associados = React.Children.map(children, (child, index) => {
    if (!React.isValidElement(child) || index > 0) return child;
    const atuais = child.props as {
      id?: string;
      "aria-describedby"?: string;
      "aria-invalid"?: boolean;
    };
    campoId = atuais.id || gerado;
    const describedBy =
      [erro ? erroId : null, !erro && dica ? dicaId : null, atuais["aria-describedby"]]
        .filter(Boolean)
        .join(" ") || undefined;
    return React.cloneElement(
      child as React.ReactElement<{
        id?: string;
        "aria-describedby"?: string;
        "aria-invalid"?: boolean;
      }>,
      {
        id: campoId,
        "aria-invalid": erro ? true : atuais["aria-invalid"],
        "aria-describedby": describedBy,
      },
    );
  });

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={campoId}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
        {obrigatorio && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {associados}
      {dica && !erro && (
        <p id={dicaId} className="text-xs text-slate-500 dark:text-slate-400">
          {dica}
        </p>
      )}
      {erro && (
        <p id={erroId} className="text-xs text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
    </div>
  );
}

/** Alias compatível */
export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-sm font-medium text-slate-700 dark:text-slate-300",
        className,
      )}
      {...props}
    />
  );
}
