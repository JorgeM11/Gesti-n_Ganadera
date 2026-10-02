import { useState } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

/**
 * InputField — Campo de texto reutilizable
 * Sistema de diseño: Terra Form ("The Pastoral Editorial")
 *
 * Props:
 *   id           — ID único del input (requerido para accesibilidad)
 *   label        — Etiqueta visible del campo
 *   type         — Tipo de input: "text" | "email" | "password" (default: "text")
 *   placeholder  — Texto placeholder
 *   autoComplete — Valor del atributo autocomplete
 *   error        — Mensaje de error (string | undefined)
 *   registration — Objeto retornado por react-hook-form register()
 *   icon         — Componente de ícono de lucide-react (optional)
 *   hint         — Texto de ayuda debajo del campo (optional)
 */
export default function InputField({
  id,
  label,
  type = "text",
  placeholder,
  autoComplete,
  error,
  registration,
  icon: Icon,
  rightIcon: RightIcon,
  hint,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label */}
      {label && (
        <label
          htmlFor={id}
          className={`font-sans text-xs font-bold uppercase tracking-wider transition-colors duration-150 ${
            error ? "text-red-600" : "text-neutral-700"
          }`}
        >
          {label}
        </label>
      )}

      {/* Input wrapper */}
      <div
        className={`group relative flex items-center transition-all duration-200 bg-neutral-50/80 hover:bg-neutral-50 focus-within:bg-white rounded-2xl min-h-[52px] border ${
          error
            ? "border-red-400 ring-4 ring-red-500/10"
            : "border-neutral-200/90 hover:border-neutral-300 focus-within:border-[#1B4820] focus-within:ring-4 focus-within:ring-[#1B4820]/10 shadow-2xs"
        }`}
      >
        {/* Left icon */}
        {Icon && (
          <span className="absolute left-3.5 pointer-events-none transition-colors duration-200 text-neutral-400 group-focus-within:text-[#1B4820]">
            <Icon size={19} strokeWidth={1.85} />
          </span>
        )}

        <input
          id={id}
          type={resolvedType}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          {...registration}
          className={`w-full bg-transparent outline-none text-neutral-900 font-sans text-sm sm:text-base py-3 placeholder:text-neutral-400 placeholder:font-normal placeholder:opacity-75 ${
            Icon ? "pl-11" : "pl-4"
          } ${isPassword || RightIcon ? "pr-12" : "pr-4"}`}
        />

        {RightIcon && !isPassword && (
          <span className="absolute right-3.5 pointer-events-none text-neutral-400">
            <RightIcon size={19} strokeWidth={1.85} />
          </span>
        )}

        {/* Toggle visibilidad de contraseña */}
        {isPassword && (
          <button
            type="button"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2.5 flex items-center justify-center p-2 rounded-xl transition-all duration-150 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 active:scale-95 bg-transparent border-none cursor-pointer"
          >
            {showPassword ? (
              <EyeOff size={18} strokeWidth={1.85} />
            ) : (
              <Eye size={18} strokeWidth={1.85} />
            )}
          </button>
        )}
      </div>

      {/* Hint text */}
      {hint && !error && (
        <p id={`${id}-hint`} className="font-sans text-xs text-neutral-500 m-0 leading-4">
          {hint}
        </p>
      )}

      {/* Error message */}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-center gap-1.5 font-sans text-xs font-medium text-red-600 m-0 mt-0.5"
        >
          <AlertCircle size={13} strokeWidth={2} className="shrink-0 text-red-500" />
          {error}
        </p>
      )}
    </div>
  );
}
