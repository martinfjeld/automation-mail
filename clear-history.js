const https = require("https");

const PRODUCTION_URL = "https://automation-mail-zk8t.onrender.com";

// Empty history array wrapped in the expected format
const emptyHistory = JSON.stringify({ entries: [] });

const options = {
  hostname: "automation-mail-zk8t.onrender.com",
  path: "/api/history/upload",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(emptyHistory),
  },
};

console.log("🗑️  Clearing all history entries from production...");

const req = https.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    if (res.statusCode === 200) {
      console.log("✅ History cleared successfully!");
      console.log("📊 All entries have been removed from production");
    } else {
      console.error(`❌ Failed to clear history. Status: ${res.statusCode}`);
      console.error("Response:", data);
    }
  });
});

req.on("error", (error) => {
  console.error("❌ Error clearing history:", error.message);
});

req.write(emptyHistory);
req.end();
