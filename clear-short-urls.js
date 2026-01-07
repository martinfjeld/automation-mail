const https = require("https");

const PRODUCTION_URL = "https://automation-mail-zk8t.onrender.com";

const options = {
  hostname: "automation-mail-zk8t.onrender.com",
  path: "/api/short-urls",
  method: "DELETE",
};

console.log("🗑️  Clearing all short URLs from production...");

const req = https.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    if (res.statusCode === 200) {
      console.log("✅ Short URLs cleared successfully!");
      console.log("Response:", data);
    } else {
      console.error(`❌ Failed to clear. Status: ${res.statusCode}`);
      console.error("Response:", data);
    }
  });
});

req.on("error", (error) => {
  console.error("❌ Error:", error.message);
});

req.end();
