// Force sync ALL email content from history.json to Notion "Melding jeg sendte" field
// This version updates ALL entries regardless of current content
require("dotenv").config();
const fs = require("fs");
const readline = require("readline");
const { Client } = require("@notionhq/client");

// Initialize Notion client
const notionClient = new Client({ auth: process.env.NOTION_TOKEN });
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function updateNotionMessage(pageId, emailContent, companyName) {
  if (!pageId) {
    console.log(`  ⚠️ No pageId for ${companyName}, skipping`);
    return false;
  }

  // Truncate message to 2000 characters if needed
  const truncatedMessage =
    emailContent.length > 2000
      ? emailContent.substring(0, 1997) + "..."
      : emailContent;

  try {
    await notionClient.pages.update({
      page_id: pageId,
      properties: {
        "Melding jeg sendte": {
          rich_text: [
            {
              text: {
                content: truncatedMessage,
              },
            },
          ],
        },
      },
    });

    return true;
  } catch (error) {
    if (error.code === "rate_limited") {
      console.log(`  ⚠️ Rate limited, waiting 5s and retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      try {
        await notionClient.pages.update({
          page_id: pageId,
          properties: {
            "Melding jeg sendte": {
              rich_text: [
                {
                  text: {
                    content: truncatedMessage,
                  },
                },
              ],
            },
          },
        });
        return true;
      } catch (retryError) {
        console.log(`  ❌ Failed after retry: ${retryError.message}`);
        return false;
      }
    }
    console.log(`  ❌ Failed: ${error.message}`);
    return false;
  }
}

async function main() {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
    console.error("❌ Missing NOTION_TOKEN or NOTION_DATABASE_ID in .env file");
    rl.close();
    process.exit(1);
  }

  console.log("🔍 Loading history entries...\n");

  const history = JSON.parse(fs.readFileSync("./history.json", "utf-8"));

  // Filter entries that have notionPageId and emailContent
  const entriesWithNotion = history.filter(
    (e) => e.notionPageId && e.emailContent
  );

  if (entriesWithNotion.length === 0) {
    console.log("❌ No entries found with both notionPageId and emailContent");
    rl.close();
    return;
  }

  console.log(`Found ${entriesWithNotion.length} entries with Notion pages:\n`);

  // Show entries with meeting proposals
  const withMeetings = entriesWithNotion.filter(
    (e) =>
      e.emailContent &&
      e.emailContent.includes("Her har du tre forslag til møter")
  );

  console.log(
    `📅 ${withMeetings.length} entries have meeting proposals in email content`
  );
  console.log(
    `📝 ${entriesWithNotion.length} entries will be force-synced to Notion\n`
  );

  entriesWithNotion.slice(0, 5).forEach((e, i) => {
    const hasMeetings = e.emailContent.includes(
      "Her har du tre forslag til møter"
    );
    const icon = hasMeetings ? "✅" : "📧";
    console.log(`${icon} ${i + 1}. ${e.companyName}`);
  });

  if (entriesWithNotion.length > 5) {
    console.log(`... and ${entriesWithNotion.length - 5} more`);
  }

  console.log("\n⚠️⚠️⚠️  WARNING: FORCE SYNC MODE  ⚠️⚠️⚠️");
  console.log("⚠️  This will UPDATE ALL entries in Notion,");
  console.log("⚠️  even if they already have the correct content.");
  console.log(
    "⚠️  Use this if you want to ensure 100% sync with history.json\n"
  );

  const answer = await question("Are you sure you want to proceed? (yes/no): ");

  if (answer.toLowerCase() !== "yes") {
    console.log("❌ Aborted");
    rl.close();
    return;
  }

  console.log("\n🚀 Starting force sync process...\n");

  let success = 0;
  let failed = 0;

  for (let i = 0; i < entriesWithNotion.length; i++) {
    const entry = entriesWithNotion[i];
    const hasMeetings = entry.emailContent.includes(
      "Her har du tre forslag til møter"
    );
    const icon = hasMeetings ? "📅" : "📧";

    console.log(
      `${icon} [${i + 1}/${entriesWithNotion.length}] ${entry.companyName}`
    );

    const updated = await updateNotionMessage(
      entry.notionPageId,
      entry.emailContent,
      entry.companyName
    );

    if (updated) {
      console.log("  ✅ Force synced to Notion");
      success++;
    } else {
      failed++;
    }

    // Wait 3 seconds between requests to avoid rate limiting
    if (i < entriesWithNotion.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`\n📊 Force sync complete!`);
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Total: ${entriesWithNotion.length}\n`);

  rl.close();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  rl.close();
  process.exit(1);
});
