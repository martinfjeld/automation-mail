# Booking Success Page Implementation

## Overview
Replace your current BookingPage component with this design to show the beautiful success screen with meeting and calendar links.

## React Component (BookingSuccessPage.tsx)

```tsx
import React from 'react';
import styles from './BookingSuccessPage.module.scss';

interface BookingSuccessPageProps {
  displayTime: string;    // e.g., "Ons 8. jan, 14:00–14:30"
  meetLink: string;       // Google Meet URL
  eventLink: string;      // Google Calendar event URL
}

const BookingSuccessPage: React.FC<BookingSuccessPageProps> = ({
  displayTime,
  meetLink,
  eventLink,
}) => {
  return (
    <div className={styles.page}>
      {/* SVG Gradient Definition */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="iconGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#e3deea', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#edd1d1', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
      </svg>

      <div className={styles.container}>
        <div className={styles.containerInner}>
          <div className={styles.checkmark}>
            <svg viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1>Møtet er bekreftet! 🎉</h1>
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
                <div className={styles.detailValue}>{displayTime}</div>
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
                  <a href={meetLink}>Google Meet</a>
                </div>
              </div>
            </div>
          </div>

          <a href={meetLink} className={styles.button}>
            Bli med på møtet
          </a>
          <a href={eventLink} className={styles.secondaryButton}>
            Åpne i kalender
          </a>
        </div>
      </div>
    </div>
  );
};

export default BookingSuccessPage;
```

## SCSS Styles (BookingSuccessPage.module.scss)

```scss
.page {
  background: #0f0f0f;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.container {
  position: relative;
  border-radius: 16px;
  padding: 2px;
  max-width: 500px;
  width: 100%;
  background: linear-gradient(89deg, #e3deea 2.02%, #edd1d1 98.29%);
}

.containerInner {
  background: transparent;
  border-radius: 14px;
  padding: 48px;
  text-align: center;
}

.checkmark {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  background: #0f0f0f;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 48px;
    height: 48px;
    stroke: white;
    stroke-width: 3;
    fill: none;
  }
}

h1 {
  font-size: 32px;
  color: #0f0f0f;
  font-family: 'Europa Grotesk SH', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  text-transform: uppercase;
  margin-bottom: 16px;
}

.subtitle {
  color: #0f0f0f;
  font-size: 16px;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

.details {
  display: flex;
  flex-direction: column;
  background: #0f0f0f;
  border-radius: 12px;
  padding: 24px;
  margin: 24px 0;
  text-align: left;
  gap: 16px;
}

.detailRow {
  display: flex;
  align-items: flex-start;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);

  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
}

.detailIcon {
  width: 24px;
  height: 24px;
  margin-right: 12px;
  flex-shrink: 0;
  stroke: url(#iconGradient);
}

.detailContent {
  flex: 1;
  margin-top: 0;
}

.detailLabel {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  color: #fff;
}

.detailValue {
  font-size: 16px;
  color: #fff;
  font-weight: 500;

  a {
    color: #fff;
    text-decoration: none;
  }
}

.button {
  display: inline-block;
  padding: 14px 32px;
  border-radius: 9999px;
  text-decoration: none;
  font-weight: 600;
  margin-top: 8px;
  transition: opacity 0.2s;
  background-color: #0f0f0f;
  font-family: 'Europa Grotesk SH', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  text-transform: uppercase;
  color: #fff;

  &:hover {
    opacity: 0.9;
  }
}

.secondaryButton {
  display: inline-block;
  background: transparent;
  border: 2px solid #0f0f0f;
  padding: 14px 32px;
  border-radius: 9999px;
  text-decoration: none;
  font-weight: 600;
  margin-top: 8px;
  margin-left: 8px;
  transition: opacity 0.2s;
  font-family: 'Europa Grotesk SH', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  text-transform: uppercase;
  color: #0f0f0f;

  &:hover {
    opacity: 0.9;
  }
}
```

## How to Integrate in Your BookingPage

In your current BookingPage component where you handle the form submission, after a successful booking, show this success component:

```tsx
import React, { useState } from 'react';
import BookingSuccessPage from './BookingSuccessPage';

const BookingPage: React.FC = () => {
  const [bookingSuccess, setBookingSuccess] = useState<{
    displayTime: string;
    meetLink: string;
    eventLink: string;
  } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('https://automation-mail-zk8t.onrender.com/api/calendar/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: bookingToken,  // from URL params
          clientName: name,
          clientEmail: email,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Show success screen with the booking details
        setBookingSuccess({
          displayTime: data.display,
          meetLink: data.meetLink,
          eventLink: data.eventLink,
        });
      } else {
        throw new Error(data.message || 'Google Calendar not configured');
      }
    } catch (error: any) {
      console.error('Booking error:', error);
      alert('Booking error: ' + error.message);
    }
  };

  // If booking succeeded, show success page
  if (bookingSuccess) {
    return (
      <BookingSuccessPage
        displayTime={bookingSuccess.displayTime}
        meetLink={bookingSuccess.meetLink}
        eventLink={bookingSuccess.eventLink}
      />
    );
  }

  // Otherwise show the booking form
  return (
    <div>
      <form onSubmit={onSubmit}>
        {/* Your booking form fields */}
      </form>
    </div>
  );
};

export default BookingPage;
```

## API Response Format

Your backend `/api/calendar/book` endpoint returns:

```json
{
  "success": true,
  "meetLink": "https://meet.google.com/abc-defg-hij",
  "eventLink": "https://calendar.google.com/calendar/event?eid=...",
  "display": "Ons 8. jan, 14:00–14:30",
  "message": "Møte booket!"
}
```

These fields map directly to the success component props.

---

## Error Screen Component

## React Component (BookingErrorPage.tsx)

```tsx
import React from 'react';
import styles from './BookingErrorPage.module.scss';

interface BookingErrorPageProps {
  errorMessage: string;  // e.g., "Tidspunktet er ikke lenger tilgjengelig"
}

const BookingErrorPage: React.FC<BookingErrorPageProps> = ({ errorMessage }) => {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.containerInner}>
          <div className={styles.errorIcon}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1>Kunne ikke booke møtet</h1>
          <p dangerouslySetInnerHTML={{ __html: errorMessage }} />
        </div>
      </div>
    </div>
  );
};

export default BookingErrorPage;
```

## SCSS Styles (BookingErrorPage.module.scss)

```scss
.page {
  background: #0f0f0f;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.container {
  position: relative;
  border-radius: 16px;
  padding: 2px;
  max-width: 500px;
  width: 100%;
  background: linear-gradient(89deg, #e3deea 2.02%, #edd1d1 98.29%);
}

.containerInner {
  background: transparent;
  border-radius: 14px;
  padding: 48px;
  text-align: center;
}

.errorIcon {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  background: #0f0f0f;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 48px;
    height: 48px;
    stroke: white;
    stroke-width: 3;
    fill: none;
  }
}

h1 {
  font-size: 32px;
  color: #0f0f0f;
  font-family: 'Europa Grotesk SH', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  text-transform: uppercase;
  margin-bottom: 16px;
}

p {
  color: #0f0f0f;
  font-size: 16px;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  line-height: 1.6;

  a {
    color: #0f0f0f;
    font-weight: bold;
  }
}
```

## Complete Integration with Error Handling

```tsx
import React, { useState } from 'react';
import BookingSuccessPage from './BookingSuccessPage';
import BookingErrorPage from './BookingErrorPage';

const BookingPage: React.FC = () => {
  const [bookingSuccess, setBookingSuccess] = useState<{
    displayTime: string;
    meetLink: string;
    eventLink: string;
  } | null>(null);
  
  const [bookingError, setBookingError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('https://automation-mail-zk8t.onrender.com/api/calendar/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: bookingToken,  // from URL params
          clientName: name,
          clientEmail: email,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Show error screen
        setBookingError(data.message || 'Det oppstod en feil. Vennligst prøv igjen.');
        return;
      }

      // Show success screen with the booking details
      setBookingSuccess({
        displayTime: data.display,
        meetLink: data.meetLink,
        eventLink: data.eventLink,
      });
    } catch (error: any) {
      console.error('Booking error:', error);
      setBookingError('Det oppstod en feil. Vennligst prøv igjen.');
    }
  };

  // If booking succeeded, show success page
  if (bookingSuccess) {
    return (
      <BookingSuccessPage
        displayTime={bookingSuccess.displayTime}
        meetLink={bookingSuccess.meetLink}
        eventLink={bookingSuccess.eventLink}
      />
    );
  }

  // If booking failed, show error page
  if (bookingError) {
    return <BookingErrorPage errorMessage={bookingError} />;
  }

  // Otherwise show the booking form
  return (
    <div>
      <form onSubmit={onSubmit}>
        {/* Your booking form fields */}
      </form>
    </div>
  );
};

export default BookingPage;
```

## Error Messages from Backend

Your backend can return these error messages:

- `"Google Calendar not configured"` - Missing environment variables
- `"Tidspunktet er ikke lenger tilgjengelig"` - Time slot already booked
- `"Det oppstod en feil. Vennligst prøv igjen."` - Generic error

The backend also adds contact info for unavailable slots:
```
Tidspunktet er ikke lenger tilgjengelig

Send meg en mail på martin@no-offence.io så finner vi et nytt tidspunkt!
```

---

## Notes

1. **Europa Grotesk SH Font**: Make sure you have this font loaded in your app, or it will fall back to system fonts
2. **Gradient**: The SVG gradient definition must be included for the icon colors to work
3. **Links**: Both buttons are actual `<a>` tags so users can open in new tabs if needed
4. **Mobile Responsive**: The design is responsive with proper padding and sizing
5. **Error HTML**: Use `dangerouslySetInnerHTML` for error messages since the backend may include HTML (like mailto links)
