type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  className?: string;
  variant?: "primary" | "secondary" | "danger" | "outline";
  disabled?: boolean;

  // 🔥 NEW (SaaS FEATURE SUPPORT)
  loading?: boolean;
  fullWidth?: boolean;
};

export default function Button({
  children,
  onClick,
  type = "button",
  className = "",
  variant = "primary",
  disabled = false,
  loading = false,
  fullWidth = false,
}: ButtonProps) {
  const baseStyles =
    "px-4 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2";

  const variants = {
    primary: "bg-black text-white hover:bg-gray-800",
    secondary: "bg-blue-600 text-white hover:bg-blue-700",
    danger: "bg-red-600 text-white hover:bg-red-700",
    outline:
      "border border-gray-300 text-gray-700 hover:bg-gray-100",
  };

  const disabledStyles =
    "opacity-50 cursor-not-allowed pointer-events-none";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${disabled || loading ? disabledStyles : ""}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
    >
      {loading ? "Loading..." : children}
    </button>
  );
}