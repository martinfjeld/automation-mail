// Upload local history.json to production backend persistent storage
const fs = require("fs");
const https = require("https");

const BACKEND_URL = "https://automation-mail-zk8t.onrender.com";

// Read local file
const localHistory = JSON.parse(fs.readFileSync("./history.json", "utf-8"));

console.log(
  `📤 Uploading ${localHistory.length} history entries to production...`
);

const data = JSON.stringify({ entries: localHistory });

const options = {
  hostname: "automation-mail-zk8t.onrender.com",
  path: "/api/history/upload",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(data),
  },
};

const req = https.request(options, (res) => {
  let body = "";
  res.on("data", (chunk) => (body += chunk));
  res.on("end", () => {
    if (res.statusCode === 200) {
      const result = JSON.parse(body);
      console.log(
        `✅ Successfully uploaded ${
          result.count || localHistory.length
        } entries!`
      );
      console.log(result.message || "Upload complete");
    } else {
      console.error(`❌ Upload failed with status ${res.statusCode}`);
      console.error(body);
    }
  });
});

req.on("error", (e) => {
  console.error(`❌ Error: ${e.message}`);
});

req.write(data);
req.end();
