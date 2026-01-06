import React from "react";
import styles from "./AlertModal.module.scss";

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  warning?: string;
  disclaimer?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmButtonStyle?: "danger" | "primary" | "light";
}

const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  warning,
  disclaimer,
  confirmText = "Bekreft",
  cancelText = "Avbryt",
  onConfirm,
  onCancel,
  confirmButtonStyle = "danger",
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.modalTitle}>{title}</h2>
        <div className={styles.messageContainer}>
          <p className={styles.modalMessage}>{message}</p>
          {warning && <p className={styles.modalWarning}>{warning}</p>}
        </div>
        <div className={styles.modalActions}>
          {onCancel && (
            <button className={styles.modalCancelButton} onClick={onCancel}>
              {cancelText}
            </button>
          )}
          <button
            className={`${styles.modalConfirmButton} ${
              confirmButtonStyle === "danger"
                ? styles.danger
                : confirmButtonStyle === "light"
                ? styles.light
                : styles.primary
            }`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
        {disclaimer && <p className={styles.modalDisclaimer}>({disclaimer})</p>}
      </div>
    </div>
  );
};

export default AlertModal;
