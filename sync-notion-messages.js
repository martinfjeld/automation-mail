// Sync email content from history.json to Notion "Melding jeg sendte" field
// This ensures Notion has the most up-to-date message including meeting proposals
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

async function checkNotionNeedsUpdate(pageId, companyName) {
  try {
    const page = await notionClient.pages.retrieve({ page_id: pageId });
    const meldingField = page.properties["Melding jeg sendte"];

    if (
      meldingField &&
      meldingField.rich_text &&
      meldingField.rich_text.length > 0
    ) {
      const currentText = meldingField.rich_text[0].text.content;
      const hasMeetingText = currentText.includes(
        "Her har du tre forslag til møter"
      );

      // Debug: Show first 100 chars of current text
      console.log(
        `    📝 Current text preview: "${currentText.substring(0, 100)}..."`
      );
      console.log(`    🔍 Has meeting text: ${hasMeetingText}`);

      // Return true if it NEEDS update (i.e., doesn't have the meeting text)
      return !hasMeetingText;
    }

    console.log(`    📝 Field is empty, needs update`);
    return true; // Empty field, needs update
  } catch (error) {
    if (error.code === "rate_limited") {
      // Wait 5 seconds and retry
      await new Promise((resolve) => setTimeout(resolve, 5000));
      try {
        const page = await notionClient.pages.retrieve({ page_id: pageId });
        const meldingField = page.properties["Melding jeg sendte"];

        if (
          meldingField &&
          meldingField.rich_text &&
          meldingField.rich_text.length > 0
        ) {
          const currentText = meldingField.rich_text[0].text.content;
          const hasMeetingText = currentText.includes(
            "Her har du tre forslag til møter"
          );
          console.log(`    🔄 Retry - Has meeting text: ${hasMeetingText}`);
          return !hasMeetingText;
        }
        return true;
      } catch (retryError) {
        console.log(
          `  ⚠️ Could not check Notion page after retry: ${retryError.message}`
        );
        return false;
      }
    }
    console.log(`  ⚠️ Could not check Notion page: ${error.message}`);
    return false; // Skip if we can't read it
  }
}

async function updateNotionMessage(pageId, emailContent, companyName) {
  if (!pageId) {
    console.log(`  ⚠️ No pageId for ${companyName}, skipping`);
    return { updated: false, reason: "no-pageid" };
  }

  try {
    // Always update - replace the entire field with new content
    // Truncate message to 2000 characters if needed
    const truncatedMessage =
      emailContent.length > 2000
        ? emailContent.substring(0, 1997) + "..."
        : emailContent;

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

    return { updated: true, reason: "success" };
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
    return { updated: false, reason: "error" };
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
    `📝 ${entriesWithNotion.length} entries will be synced to Notion\n`
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

  console.log(
    "\n⚠️  This script will update the 'Melding jeg sendte' field in Notion"
  );
  console.log(
    "⚠️  ONLY for entries that don't already have meeting proposals."
  );
  console.log("⚠️  It will check each entry and skip those already updated.\n");

  const answer = await question("Do you want to proceed? (yes/no): ");

  if (answer.toLowerCase() !== "yes") {
    console.log("❌ Aborted");
    rl.close();
    return;
  }

  console.log("\n🚀 Starting sync process...\n");

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < entriesWithNotion.length; i++) {
    const entry = entriesWithNotion[i];
    const hasMeetings = entry.emailContent.includes(
      "Her har du tre forslag til møter"
    );
    const icon = hasMeetings ? "📅" : "📧";

    console.log(
      `${icon} [${i + 1}/${entriesWithNotion.length}] ${entry.companyName}`
    );

    const result = await updateNotionMessage(
      entry.notionPageId,
      entry.emailContent,
      entry.companyName
    );

    if (result.updated) {
      console.log("  ✅ Synced to Notion");
      success++;
    } else if (result.reason === "already-has-meetings") {
      console.log("  ⏭️  Already has meetings, skipped");
      skipped++;
    } else {
      failed++;
    }

    // Wait 3 seconds between requests to avoid rate limiting
    if (i < entriesWithNotion.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`\n📊 Sync complete!`);
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ⏭️  Skipped (already updated): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Total: ${entriesWithNotion.length}\n`);

  rl.close();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  rl.close();
  process.exit(1);
});
