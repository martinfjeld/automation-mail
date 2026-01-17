/**
 * Test if the refresh token works
 */

const { google } = require("googleapis");
require("dotenv").config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error("Missing required environment variables!");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const calendar = google.calendar({ version: "v3", auth: oauth2Client });

console.log("Testing refresh token...\n");
console.log("Token preview:", REFRESH_TOKEN.substring(0, 20) + "...");
console.log();

calendar.calendarList
  .list()
  .then((response) => {
    console.log("✅ Token works! Your calendars:");
    response.data.items.forEach((cal) => {
      console.log(`  - ${cal.summary}`);
    });
  })
  .catch((err) => {
    console.error("❌ Token failed:");
    console.error(err.message);
    if (err.response?.data) {
      console.error(err.response.data);
    }
  });
