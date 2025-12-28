import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import styles from "./NotFound.module.scss";

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.notFound}>
      <h1 className={styles.title}>404</h1>
      <p className={styles.description}>
        Oops! The page you're looking for doesn't exist.
      </p>
      <Button onClick={() => navigate("/")}>Go Home</Button>
    </div>
  );
};

export default NotFound;
