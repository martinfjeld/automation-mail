/**
 * Helper script to get Google Calendar API refresh token
 *
 * Usage:
 * 1. Replace CLIENT_ID and CLIENT_SECRET below
 * 2. Run: node get-refresh-token.js
 * 3. Visit the URL it prints
 * 4. Authorize the app
 * 5. Copy the code and paste in terminal
 * 6. Copy the refresh token to your .env file
 */

const { google } = require("googleapis");
const readline = require("readline");

// === REPLACE THESE WITH YOUR CREDENTIALS ===
const CLIENT_ID =
  "122636953493-aqd4msl9re5i0ure54k0lgjcf38gqtvp.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob"; // For desktop app
// ============================================

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent", // Force consent screen to get refresh token
});

console.log("\n=================================================");
console.log("📅 Google Calendar API - Get Refresh Token");
console.log("=================================================\n");
console.log("1. Visit this URL to authorize:\n");
console.log(authUrl);
console.log("\n2. Sign in with your Google account");
console.log("3. Grant permissions");
console.log("4. Copy the authorization code\n");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter the authorization code here: ", (code) => {
  rl.close();

  oauth2Client.getToken(code, (err, token) => {
    if (err) {
      console.error("\n❌ Error retrieving access token:", err.message);
      return;
    }

    console.log("\n✅ Success! Here is your refresh token:\n");
    console.log("=================================================");
    console.log(token.refresh_token);
    console.log("=================================================\n");
    console.log("Add this to your .env file as:\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${token.refresh_token}\n`);
  });
});
