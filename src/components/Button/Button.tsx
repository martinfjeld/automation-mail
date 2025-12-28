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
  loading?: boolean;
  loadingText?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  onClick,
  disabled = false,
  href,
  target,
  rel,
  loading = false,
  loadingText = "",
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
      className={`${styles.button} ${styles[variant]} ${loading ? styles.loading : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {loading && <span className={styles.loadingOverlay}></span>}
      <span className={styles.buttonText}>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
};

export default Button;
