import React from "react";
import { Link } from "react-router-dom";
import styles from "./Nav.module.scss";

const Nav: React.FC = () => {
  return (
    <nav className={styles.nav}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>
          Figma Automator
        </Link>
        <ul className={styles.links}>
          <li>
            <Link to="/" className={styles.link}>
              Generator
            </Link>
          </li>
          <li>
            <Link to="/about" className={styles.link}>
              About
            </Link>
          </li>
          <li>
            <Link to="/setup" className={styles.link}>
              Setup
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Nav;
