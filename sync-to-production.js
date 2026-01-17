require("dotenv").config();
const axios = require("axios");
const fs = require("fs");

const BACKEND_URL =
  process.env.BACKEND_URL || "https://automation-mail-zk8t.onrender.com";

async function syncToProduction() {
  console.log("🔄 Syncing to production...\n");

  // Upload updated history.json
  console.log("📤 Uploading history.json to production...");
  const history = JSON.parse(fs.readFileSync("./history.json", "utf-8"));

  try {
    const response = await axios.post(`${BACKEND_URL}/api/upload/history`, {
      history: history,
    });

    if (response.data.success) {
      console.log(
        `✅ Successfully uploaded ${history.length} history entries to production\n`
      );
    } else {
      console.log(
        "❌ Upload failed:",
        response.data.message || "Unknown error"
      );
    }
  } catch (error) {
    console.error("❌ Error uploading history:", error.message);
  }

  console.log("✅ Sync complete!");
}

syncToProduction().catch(console.error);
