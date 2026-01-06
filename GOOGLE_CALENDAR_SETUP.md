# Google Calendar Integration Setup

This guide explains how to set up Google Calendar API for automatic meeting booking in your email campaigns.

## Prerequisites

- Google Workspace or Gmail account
- Google Cloud Console access

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Name it something like "Figma Automator Calendar"

## Step 2: Enable Google Calendar API

1. In the Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Google Calendar API"
3. Click **Enable**

## Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen:

   - User Type: **External** (or Internal if you have Google Workspace)
   - App name: "Figma Automator"
   - User support email: your email
   - Developer contact: your email
   - Add scope: `https://www.googleapis.com/auth/calendar`
   - Add test users (your email)
   - Click **Save and Continue**

4. Create OAuth Client ID:

   - Application type: **Desktop app** (or Web application)
   - Name: "Figma Automator Desktop"
   - Click **Create**

5. Download the credentials JSON file (contains CLIENT_ID and CLIENT_SECRET)

## Step 4: Get Refresh Token

You need to authorize the app once to get a refresh token. Run this Node.js script:

```javascript
const { google } = require("googleapis");
const readline = require("readline");

const CLIENT_ID = "YOUR_CLIENT_ID";
const CLIENT_SECRET = "YOUR_CLIENT_SECRET";
const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob"; // For desktop app

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
});

console.log("Authorize this app by visiting this URL:", authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter the code from that page here: ", (code) => {
  rl.close();
  oauth2Client.getToken(code, (err, token) => {
    if (err) {
      console.error("Error retrieving access token", err);
      return;
    }
    console.log("\n=== REFRESH TOKEN ===");
    console.log(token.refresh_token);
    console.log("\nAdd this to your .env file as GOOGLE_REFRESH_TOKEN");
  });
});
```

**Steps:**

1. Install googleapis: `npm install googleapis`
2. Replace CLIENT_ID and CLIENT_SECRET
3. Run the script: `node get-refresh-token.js`
4. Visit the URL it prints
5. Authorize the app
6. Copy the authorization code
7. Paste it into the terminal
8. Copy the refresh token it prints

## Step 5: Add Environment Variables

Add these to your `.env` file:

```env
# Google Calendar API
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REFRESH_TOKEN=your_refresh_token_here
MY_EMAIL=your.email@example.com
BASE_URL=http://localhost:3001
```

For production (Render.com):

```env
BASE_URL=https://your-app.onrender.com
```

## Step 6: Install Dependencies

```bash
npm install googleapis google-auth-library
```

## How It Works

1. **Email Generation**: When generating an email, the system:

   - Checks your calendar for the next 14 days
   - Finds 3 available 30-minute slots (Mon-Fri, 09:00-16:00)
   - Generates secure booking links for each slot
   - Includes these links in the email

2. **Customer Books**: When customer clicks a booking link:

   - System verifies slot is still available
   - Creates Google Calendar event
   - Adds Google Meet link
   - Invites both you and the customer
   - Shows confirmation page with Meet link

3. **Calendar Event**: Contains:
   - Title: "Møte med [Customer Name]"
   - Description: Meeting details
   - Google Meet conference link
   - Email invites sent to both parties
   - Reminders: 1 day before and 30 minutes before

## Booking URL Format

```
https://your-app.com/api/calendar/book/TOKEN?customerEmail=email@example.com&customerName=Name
```

The TOKEN contains:

- Meeting start time (ISO 8601)
- Meeting end time (ISO 8601)
- Your email
- Timestamp

## Email Example

```
Hei Erik,

Jeg heter Martin Fjeld og jobber i et kreativt design- og digitalbyrå kalt No Offence...

Jeg har satt sammen en pitch deck til dere som viser et forslag til hvordan nye nettsider for dere kan se ut + et lite bilde av hvem vi er.
https://www.no-offence.io/presentation/company-name/abc123

Hvis du ønsker et kort møte for å diskutere mulighetene, kan du velge et tidspunkt som passer deg:

1. Tue 7 Jan, 10:00–10:30
   → https://your-app.com/api/calendar/book/ABC123...

2. Wed 8 Jan, 13:00–13:30
   → https://your-app.com/api/calendar/book/DEF456...

3. Fri 10 Jan, 09:30–10:00
   → https://your-app.com/api/calendar/book/GHI789...

Med vennlig hilsen,
Martin Fjeld
```

## Troubleshooting

### "Invalid credentials"

- Double-check CLIENT_ID, CLIENT_SECRET, and REFRESH_TOKEN
- Make sure you copied them correctly (no extra spaces)

### "Calendar API not enabled"

- Go to Google Cloud Console
- Enable Google Calendar API for your project

### "insufficient permission"

- Make sure you authorized with the correct scope: `https://www.googleapis.com/auth/calendar`
- Re-run the refresh token script

### "Time slot no longer available"

- The system automatically checks availability before booking
- If busy, it will return an error
- Consider implementing fallback logic to suggest next available slot

## Security Notes

- Booking tokens are base64-encoded but not encrypted
- They contain timestamp to prevent replay attacks
- Tokens should expire after 14 days (add expiration logic if needed)
- Store refresh token securely (never commit to git)
- Use HTTPS in production

## Next Steps

1. Test the integration by generating an email
2. Check that 3 meeting proposals appear
3. Click a booking link to verify it creates a calendar event
4. Confirm you receive the calendar invite
5. Test with a real customer email address

## Optional Enhancements

- Add timezone detection for international customers
- Allow custom meeting durations (15, 30, 60 minutes)
- Add meeting types (phone, video, in-person)
- Store booking history in database
- Send reminder emails before meetings
- Add rescheduling functionality
- Implement meeting cancellation
