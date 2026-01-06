import React from "react";
import styles from "./BookingScreen.module.scss";

const BookingScreen: React.FC = () => {
  return (
    <div className={styles.page}>
      {/* SVG Gradient Definition */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="iconGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop
              offset="0%"
              style={{ stopColor: "#e3deea", stopOpacity: 1 }}
            />
            <stop
              offset="100%"
              style={{ stopColor: "#edd1d1", stopOpacity: 1 }}
            />
          </linearGradient>
        </defs>
      </svg>

      <div className={styles.container}>
        <div className={styles.containerInner}>
          <div className={styles.checkmark}>
            <svg
              width="820"
              height="288"
              viewBox="0 0 820 288"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M36.45 0.0400391L78.74 79.95V0.0400391H111.68V130.04H76.99L32.94 46.82V130.04H0V0.0400391H36.45Z"
                fill="white"
              ></path>
              <path
                d="M228.177 17.4603C216.798 6.13095 201.691 0 185.269 0C150.202 0 123.895 27.8571 123.895 65C123.895 102.143 150.202 130 185.269 130C201.681 130 216.977 123.869 228.177 112.54C239.926 100.843 245.895 84.871 245.895 65C245.895 45.129 239.926 29.3452 228.177 17.4603ZM185.269 103.075C167.92 103.075 156.729 88.4028 156.729 64.8214C156.729 41.2401 167.551 26.1905 185.269 26.1905C194.785 26.1905 202.06 30.0893 207.092 37.7083C211.387 44.5833 213.997 54.4246 213.997 64.8214C213.997 88.4028 202.986 103.075 185.269 103.075Z"
                fill="white"
              ></path>
              <path
                d="M105 172.77C93.5801 161.27 78.4201 155.04 61.9401 155.04C26.7501 155.04 0.350098 183.33 0.350098 221.04C0.350098 258.75 26.7501 287.04 61.9401 287.04C78.4101 287.04 93.7601 280.82 105 269.31C116.79 257.43 122.78 241.21 122.78 221.04C122.78 200.87 116.79 184.83 105 172.77ZM61.9401 259.7C44.5301 259.7 33.3001 244.8 33.3001 220.85C33.3001 196.9 44.1601 181.63 61.9401 181.63C71.4901 181.63 78.7901 185.59 83.8401 193.32C88.1501 200.3 90.7701 210.29 90.7701 220.85C90.7701 244.8 79.7201 259.7 61.9401 259.7Z"
                fill="white"
              ></path>
              <path
                d="M230.98 155.04V182.87H167.89V210.1H223.73V237.14H167.89V286.67H134.78V155.04H230.98Z"
                fill="white"
              ></path>
              <path
                d="M339.18 155.04V182.87H276.09V210.1H331.93V237.14H276.09V286.67H242.98V155.04H339.18Z"
                fill="white"
              ></path>
              <path
                d="M451.891 155.04V182.87H384.291V203.98H445.031V231.81H384.291V258.85H451.891V286.67H351.181V155.04H451.891Z"
                fill="white"
              ></path>
              <path
                d="M500.531 155.04L543.051 235.95V155.04H576.161V286.67H541.291L497.011 202.41V286.67H463.891V155.04H500.531Z"
                fill="white"
              ></path>
              <path
                d="M693.171 270.57C682.391 281.33 668.481 286.62 651.441 286.62C631.261 286.62 617.541 281.9 606.381 270.76C594.231 259.06 588.161 242.63 588.161 221.68C588.161 181.28 612.451 155.04 650.661 155.04C672.411 155.04 691.021 164.29 701.011 180.15C704.731 186 706.891 193.36 706.891 199.4V201.29H674.951C672.401 189.96 663.591 183.17 651.241 183.17C633.211 183.17 621.851 198.08 621.851 221.68C621.851 245.28 632.821 258.68 650.851 258.68C663.391 258.68 672.791 250.75 675.141 237.92H707.081V239.43C707.081 249.81 701.591 262.46 693.171 270.58V270.57Z"
                fill="white"
              ></path>
              <path
                d="M819.781 155.04V182.87H752.191V203.98H812.931V231.81H752.191V258.85H819.781V286.67H719.081V155.04H819.781Z"
                fill="white"
              ></path>
            </svg>
          </div>

          <h1>Møtet er bekreftet</h1>
          <p className={styles.subtitle}>
            Du vil motta en kalenderhendelse på e-post.
          </p>

          <div className={styles.details}>
            <div className={styles.detailRow}>
              <svg
                className={styles.detailIcon}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <div className={styles.detailContent}>
                <div className={styles.detailLabel}>Tidspunkt</div>
                <div className={styles.detailValue}>
                  Ons 8. jan, 14:00–14:30
                </div>
              </div>
            </div>

            <div className={styles.detailRow}>
              <svg
                className={styles.detailIcon}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <div className={styles.detailContent}>
                <div className={styles.detailLabel}>Møtelink</div>
                <div className={styles.detailValue}>
                  <a href="https://meet.google.com/abc-defg-hij">Google Meet</a>
                </div>
              </div>
            </div>
          </div>

          <a
            href="https://meet.google.com/abc-defg-hij"
            className={styles.button}
          >
            <span className={styles.buttonText}>Bli med på møtet</span>
          </a>
          <a
            href="https://calendar.google.com"
            className={styles.secondaryButton}
          >
            <span className={styles.buttonText}>Åpne i kalender</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default BookingScreen;
