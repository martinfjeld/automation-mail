import React from "react";
import styles from "./Footer.module.scss";

const Footer: React.FC = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <p className={styles.text}>
          © {new Date().getFullYear()} Figma Automator. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
