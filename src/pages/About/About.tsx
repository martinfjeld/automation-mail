import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import styles from "./About.module.scss";

const About: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.about}>
      <h1 className={styles.title}>About Figma Automator</h1>
      <div className={styles.content}>
        <p className={styles.text}>
          Figma Automator is a powerful tool designed to streamline outreach to
          Norwegian companies. It automatically extracts company information
          from Proff.no, generates personalized Norwegian sales emails using AI,
          and tracks all communications in Notion.
        </p>
        <p className={styles.text}>
          The tool analyzes company websites, identifies key decision makers
          (Styrets leder), and crafts targeted outreach emails for Video,
          Images, Web, or Branding services. All data is securely stored and
          managed server-side, with no sensitive information exposed to the
          client.
        </p>
        <p className={styles.text}>
          Built with React, TypeScript, SCSS Modules, OpenAI GPT-4, and Notion
          API integration.
        </p>
      </div>
      <Button onClick={() => navigate("/")}>Start Generating</Button>
    </div>
  );
};

export default About;
