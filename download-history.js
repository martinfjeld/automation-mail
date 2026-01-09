// Download history.json from production backend to local
const fs = require("fs");
const https = require("https");

const BACKEND_URL = "https://automation-mail-zk8t.onrender.com";

console.log("📥 Downloading history from production...");

const options = {
  hostname: "automation-mail-zk8t.onrender.com",
  path: "/api/history",
  method: "GET",
  headers: {
    "Content-Type": "application/json",
  },
};

const req = https.request(options, (res) => {
  let body = "";
  res.on("data", (chunk) => (body += chunk));
  res.on("end", () => {
    if (res.statusCode === 200) {
      const result = JSON.parse(body);
      const entries = result.data || result.entries || result;

      console.log(`✅ Downloaded ${entries.length} entries from production`);

      // Backup existing local file
      if (fs.existsSync("./history.json")) {
        const backup = `./history.backup.${Date.now()}.json`;
        fs.copyFileSync("./history.json", backup);
        console.log(`💾 Backed up local history to ${backup}`);
      }

      // Write production data to local file
      fs.writeFileSync(
        "./history.json",
        JSON.stringify(entries, null, 2),
        "utf-8"
      );
      console.log(`✅ Saved production history to ./history.json`);

      // Show some stats
      const withMeetings = entries.filter(
        (e) => e.meetingDates && e.meetingDates.length > 0
      ).length;
      const withBookingLinks = entries.filter(
        (e) => e.bookingLinks && e.bookingLinks.length > 0
      ).length;

      console.log(`\n📊 Stats:`);
      console.log(`   Total entries: ${entries.length}`);
      console.log(`   With meeting dates: ${withMeetings}`);
      console.log(`   With booking links: ${withBookingLinks}`);
    } else {
      console.error(`❌ Download failed with status ${res.statusCode}`);
      console.error(body);
    }
  });
});

req.on("error", (e) => {
  console.error(`❌ Error: ${e.message}`);
});

req.end();
