import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import styles from "./Home.module.scss";

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.home}>
      <h1 className={styles.title}>Welcome to Figma Automator</h1>
      <p className={styles.description}>
        Automate your Figma workflows with ease
      </p>
      <div className={styles.buttonGroup}>
        <Button onClick={() => navigate("/about")}>Learn More</Button>
        <Button variant="secondary" onClick={() => alert("Get Started!")}>
          Get Started
        </Button>
      </div>
    </div>
  );
};

export default Home;
