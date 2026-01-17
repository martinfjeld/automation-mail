// Clean up email content and rebuild with proper short URLs
// Then sync to Notion
require("dotenv").config();
const fs = require("fs");
const readline = require("readline");
const { Client } = require("@notionhq/client");

const notionClient = new Client({ auth: process.env.NOTION_TOKEN });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

// Remove all meeting blocks from email content
function stripMeetingBlocks(emailContent) {
  if (!emailContent) return emailContent;

  // Remove all occurrences of meeting blocks
  let cleaned = emailContent;

  // Pattern to match meeting blocks
  const meetingPattern =
    /\n*Her har du tre forslag til møter.*?(?=\n\nMed vennlig hilsen,|\n\n(?!Her har du tre forslag)|$)/gs;
  cleaned = cleaned.replace(meetingPattern, "");

  // Clean up multiple newlines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

// Add single meeting block with short URLs
function addMeetingBlock(emailContent, proposals, bookingLinks) {
  const cleaned = stripMeetingBlocks(emailContent);

  const meetingBlock =
    "\n\nHer har du tre forslag til møter. Trykk på linken for å booke:\n\n" +
    proposals
      .map((proposal, index) => {
        return `${index + 1}. ${proposal.display} - ${bookingLinks[index]}`;
      })
      .join("\n\n");

  // Insert before "Med vennlig hilsen,"
  if (cleaned.includes("Med vennlig hilsen,")) {
    return cleaned.replace(
      "Med vennlig hilsen,",
      `${meetingBlock}\n\nMed vennlig hilsen,`
    );
  } else {
    return cleaned + meetingBlock;
  }
}

// Parse proposal display and create proposal object
function createProposalFromData(meetingDate, bookingLink) {
  const date = new Date(meetingDate);
  const days = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "mai",
    "jun",
    "jul",
    "aug",
    "sep",
    "okt",
    "nov",
    "des",
  ];

  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const endDate = new Date(date.getTime() + 30 * 60 * 1000);

  const timeStart = `${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}`;
  const timeEnd = `${String(endDate.getHours()).padStart(2, "0")}:${String(
    endDate.getMinutes()
  ).padStart(2, "0")}`;

  return {
    display: `${dayName} ${day}. ${month}, ${timeStart}–${timeEnd}`,
  };
}

async function updateNotionEntry(pageId, emailContent) {
  if (!pageId) return false;

  try {
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
              text: { content: truncatedMessage },
            },
          ],
        },
      },
    });
    return true;
  } catch (error) {
    console.log(`    ⚠️ Notion update failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("🧹 CLEANING UP EMAIL CONTENT AND SYNCING\n");
  console.log("⚠️  This will:");
  console.log("   1. Remove duplicate meeting blocks from emailContent");
  console.log("   2. Add back ONE clean meeting block with short URLs");
  console.log("   3. Update history.json");
  console.log("   4. Sync cleaned content to Notion\n");

  const answer = await question("Proceed? (yes/no): ");
  if (answer.toLowerCase() !== "yes") {
    console.log("❌ Aborted");
    rl.close();
    return;
  }

  const history = JSON.parse(fs.readFileSync("./history.json", "utf-8"));

  console.log(`\n📋 Processing ${history.length} entries...\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    console.log(`[${i + 1}/${history.length}] ${entry.companyName}`);

    try {
      // Skip if no meetings
      if (
        !entry.meetingDates ||
        !entry.bookingLinks ||
        entry.meetingDates.length === 0
      ) {
        console.log("  ⏭️  No meetings to add");
        skipped++;
        continue;
      }

      // Create proposals from existing data
      const proposals = entry.meetingDates.map((date) =>
        createProposalFromData(date, null)
      );

      // Clean and rebuild email content
      const cleanedContent = addMeetingBlock(
        entry.emailContent,
        proposals,
        entry.bookingLinks
      );

      // Update entry
      entry.emailContent = cleanedContent;

      // Update Notion
      const updated = await updateNotionEntry(
        entry.notionPageId,
        cleanedContent
      );

      if (updated) {
        console.log("  ✅ Cleaned and synced");
        success++;
      } else {
        console.log("  ⚠️  Cleaned locally, Notion failed");
        success++; // Still count as success since local is fixed
      }

      // Delay to avoid rate limits
      if (i < history.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      failed++;
    }
  }

  console.log("\n💾 Saving history.json...");
  fs.writeFileSync("./history.json", JSON.stringify(history, null, 2));

  console.log("\n" + "=".repeat(50));
  console.log(`\n✅ Complete!`);
  console.log(`   ✅ Cleaned: ${success}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}\n`);

  rl.close();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  rl.close();
  process.exit(1);
});
