/**
 * PrimaryButton — Botón principal tipo pill/rounded-2xl
 * Sistema de diseño: "The Pastoral Editorial" Modernizado
 *
 * Props:
 *   type       — "button" | "submit" | "reset" (default: "button")
 *   isLoading  — Muestra spinner y deshabilita el botón
 *   disabled   — Deshabilita el botón
 *   onClick    — Handler de click (optional, para type="button")
 *   children   — Contenido/texto del botón
 *   fullWidth  — Si true, ocupa 100% del ancho (default: true)
 *   variant    — "primary" | "secondary" (default: "primary")
 */
export default function PrimaryButton({
  type = "button",
  isLoading = false,
  disabled = false,
  onClick,
  children,
  fullWidth = true,
  variant = "primary",
}) {
  const isDisabled = disabled || isLoading;

  const baseClasses =
    "group relative flex items-center justify-center gap-2.5 min-h-[52px] sm:min-h-[54px] rounded-2xl border-none px-6 font-sans text-sm font-bold tracking-wider uppercase transition-all duration-200 ease-out select-none";

  const widthClasses = fullWidth ? "w-full" : "w-auto";

  let variantClasses = "";
  if (isDisabled) {
    variantClasses =
      "bg-neutral-100 text-neutral-400 cursor-not-allowed shadow-none opacity-80";
  } else if (variant === "primary") {
    variantClasses =
      "bg-[#1B4820] hover:bg-[#153a19] text-white shadow-[0_6px_20px_rgba(27,72,32,0.28)] hover:shadow-[0_8px_25px_rgba(27,72,32,0.36)] active:scale-[0.98] cursor-pointer";
  } else {
    variantClasses =
      "bg-emerald-50 text-[#1B4820] hover:bg-emerald-100/70 active:scale-[0.98] cursor-pointer";
  }

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={`${baseClasses} ${widthClasses} ${variantClasses}`}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-1.5"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="32"
            strokeDashoffset="12"
            className="opacity-75"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
