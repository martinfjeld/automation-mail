import React from "react";
import styles from "./Button.module.scss";

interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  disabled?: boolean;
  href?: string;
  target?: string;
  rel?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  onClick,
  disabled = false,
  href,
  target,
  rel,
}) => {
  if (href) {
    return (
      <a
        className={`${styles.button} ${styles[variant]}`}
        href={href}
        target={target}
        rel={rel}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
          }
        }}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      className={`${styles.button} ${styles[variant]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;
