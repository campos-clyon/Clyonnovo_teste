"use client";

import Link from "next/link";
import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from "react";

// Cores oficiais CLYON
const COLORS = {
  primary: {
    bg: "#0891b2", // cyan-600
    bgHover: "#0e7490", // cyan-700
    text: "#ffffff",
  },
  whatsapp: {
    bg: "#25D366",
    bgHover: "#1ebe5d",
    text: "#ffffff",
  },
  outline: {
    bg: "#ffffff",
    bgHover: "#f8fafc", // slate-50
    text: "#0f172a", // slate-900
    border: "#e2e8f0", // slate-200
  },
  footer: {
    bg: "#1e293b", // slate-800
    bgHover: "#334155", // slate-700
    text: "#ffffff",
    icon: "#22d3ee", // cyan-400
  },
};

type Variant = "primary" | "whatsapp" | "outline" | "footer";
type Size = "sm" | "md" | "lg";

interface SiteButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  href?: string;
  external?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

const getStyles = (variant: Variant, size: Size) => {
  const baseStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    borderRadius: "0.875rem",
    fontWeight: 600,
    transition: "all 0.2s ease",
    cursor: "pointer",
    textDecoration: "none",
    border: "none",
  };

  // Size styles
  const sizeStyles: Record<Size, React.CSSProperties> = {
    sm: { padding: "0.5rem 1rem", fontSize: "0.875rem" },
    md: { padding: "0.75rem 1.5rem", fontSize: "0.9375rem" },
    lg: { padding: "1rem 2rem", fontSize: "1rem" },
  };

  // Variant styles
  const variantStyles: Record<Variant, React.CSSProperties> = {
    primary: {
      backgroundColor: COLORS.primary.bg,
      color: COLORS.primary.text,
      boxShadow: "0 4px 14px -4px rgba(8, 145, 178, 0.4)",
    },
    whatsapp: {
      backgroundColor: COLORS.whatsapp.bg,
      color: COLORS.whatsapp.text,
      boxShadow: "0 4px 14px -4px rgba(37, 211, 102, 0.4)",
    },
    outline: {
      backgroundColor: COLORS.outline.bg,
      color: COLORS.outline.text,
      border: `1px solid ${COLORS.outline.border}`,
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    },
    footer: {
      backgroundColor: COLORS.footer.bg,
      color: COLORS.footer.text,
    },
  };

  return { ...baseStyles, ...sizeStyles[size], ...variantStyles[variant] };
};

const getHoverStyles = (variant: Variant): React.CSSProperties => {
  const hoverMap: Record<Variant, React.CSSProperties> = {
    primary: { backgroundColor: COLORS.primary.bgHover },
    whatsapp: { backgroundColor: COLORS.whatsapp.bgHover },
    outline: { backgroundColor: COLORS.outline.bgHover },
    footer: { backgroundColor: COLORS.footer.bgHover },
  };
  return hoverMap[variant];
};

export const SiteButton = forwardRef<HTMLButtonElement, SiteButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      href,
      external = false,
      icon,
      iconPosition = "left",
      children,
      className = "",
      onClick,
      ...props
    },
    ref
  ) => {
    const styles = getStyles(variant, size);
    const iconColor = variant === "footer" ? COLORS.footer.icon : "currentColor";

    const content = (
      <>
        {icon && iconPosition === "left" && (
          <span style={{ color: iconColor, display: "flex" }}>{icon}</span>
        )}
        <span style={{ color: styles.color }}>{children}</span>
        {icon && iconPosition === "right" && (
          <span style={{ color: iconColor, display: "flex" }}>{icon}</span>
        )}
      </>
    );

    const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
      const hoverStyles = getHoverStyles(variant);
      Object.assign(e.currentTarget.style, hoverStyles);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.backgroundColor = styles.backgroundColor as string;
    };

    if (href) {
      if (external) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={styles}
            className={className}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
          >
            {content}
          </a>
        );
      }
      return (
        <Link
          href={href}
          style={styles}
          className={className}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={onClick}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        style={styles}
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        {...props}
      >
        {content}
      </button>
    );
  }
);

SiteButton.displayName = "SiteButton";

// Classes CSS para uso direto (quando não puder usar o componente)
export const BUTTON_CLASSES = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#0891b2] px-6 py-3 font-semibold text-white shadow-[0_4px_14px_-4px_rgba(8,145,178,0.4)] transition-all hover:bg-[#0e7490] [&_svg]:text-white [&_span]:text-white",
  whatsapp:
    "inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#25D366] px-6 py-3 font-semibold text-white shadow-[0_4px_14px_-4px_rgba(37,211,102,0.4)] transition-all hover:bg-[#1ebe5d] [&_svg]:text-white [&_span]:text-white",
  outline:
    "inline-flex items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-900 shadow-sm transition-all hover:bg-slate-50 [&_svg]:text-slate-900 [&_span]:text-slate-900",
  footer:
    "inline-flex items-center justify-center gap-3 rounded-lg bg-slate-800 px-4 py-3 font-medium text-white transition-all hover:bg-slate-700 [&_svg]:text-cyan-400 [&_span]:text-white hover:[&_svg]:text-white",
};

export default SiteButton;
