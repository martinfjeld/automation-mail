// Backfill missing meeting proposals for history entries
// This script manually adds meeting proposals to entries that are missing them
require("dotenv").config();
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");
const readline = require("readline");

const BACKEND_URL = "https://automation-mail-zk8t.onrender.com";

// Import Notion service for updating entries
const { Client } = require("@notionhq/client");

// Initialize Notion client
const notionClient = new Client({ auth: process.env.NOTION_API_KEY });
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Load proposed meetings to check for conflicts
function loadProposedMeetings() {
  try {
    return JSON.parse(fs.readFileSync("./proposed-meetings.json", "utf-8"));
  } catch (error) {
    console.log("⚠️  Could not load proposed-meetings.json, starting fresh");
    return [];
  }
}

// Check if a time slot is already taken
function isTimeSlotTaken(proposedMeetings, timeISO) {
  return proposedMeetings.some(
    (pm) => pm.meetingTimes && pm.meetingTimes.includes(timeISO)
  );
}

// Generate meeting proposals manually without calling API
function generateManualProposals(entryIndex, proposedMeetings) {
  const now = new Date();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;

  // Add variation based on entry index to spread out the proposals
  const daysOffset = Math.floor(entryIndex / 8); // Group every 8 entries into same week
  const hourVariation = (entryIndex % 8) * 2; // Vary by 2 hours within each day

  const startDate = new Date(
    now.getTime() + oneWeek + daysOffset * 24 * 60 * 60 * 1000
  );

  // Generate 3 proposals with varied times
  const proposals = [];
  const baseHours = [9, 11, 14]; // Base hours to start from

  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loop

  while (proposals.length < 3 && attempts < maxAttempts) {
    attempts++;
    const i = proposals.length;
    const proposalDate = new Date(
      startDate.getTime() +
        i * 24 * 60 * 60 * 1000 +
        (attempts - 1) * 60 * 60 * 1000
    );

    // Vary the hour: base hour + variation based on entry index
    const hours =
      (baseHours[i] + (entryIndex % 3) + Math.floor((attempts - 1) / 4)) % 24;
    const minutes = ((entryIndex % 4) * 15 + ((attempts - 1) % 4) * 15) % 60;

    proposalDate.setHours(hours, minutes, 0, 0);

    // Skip if this time is already taken
    if (isTimeSlotTaken(proposedMeetings, proposalDate.toISOString())) {
      continue;
    }

    const endDate = new Date(proposalDate.getTime() + 30 * 60 * 1000); // 30 min meeting

    // Create booking token in correct format: timestamp|timestamp|email
    const myEmail = process.env.MY_EMAIL || "testeguttene@gmail.com";
    const startMs = proposalDate.getTime();
    const endMs = endDate.getTime();
    const tokenData = `${startMs}|${endMs}|${myEmail}`;
    const bookingToken = Buffer.from(tokenData).toString("base64url");

    // Format display
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
    const dayName = days[proposalDate.getDay()];
    const day = proposalDate.getDate();
    const month = months[proposalDate.getMonth()];
    const timeStart = `${String(proposalDate.getHours()).padStart(
      2,
      "0"
    )}:${String(proposalDate.getMinutes()).padStart(2, "0")}`;
    const timeEnd = `${String(endDate.getHours()).padStart(2, "0")}:${String(
      endDate.getMinutes()
    ).padStart(2, "0")}`;

    proposals.push({
      startISO: proposalDate.toISOString(),
      endISO: endDate.toISOString(),
      bookingToken: bookingToken,
      display: `${dayName} ${day}. ${month}, ${timeStart}–${timeEnd}`,
    });
  }

  return proposals;
}

// Add entry to proposed meetings
function addToProposedMeetings(
  proposedMeetings,
  notionPageId,
  companyName,
  meetingDates
) {
  // Remove existing entry if present
  const filtered = proposedMeetings.filter(
    (pm) => pm.notionPageId !== notionPageId
  );

  // Add new entry
  filtered.push({
    notionPageId,
    companyName,
    meetingTimes: meetingDates,
  });

  return filtered;
}

// Save proposed meetings to file
function saveProposedMeetings(proposedMeetings) {
  fs.writeFileSync(
    "./proposed-meetings.json",
    JSON.stringify(proposedMeetings, null, 2)
  );
}

// Update Notion entry with new email content
async function updateNotionEntry(pageId, emailContent) {
  if (!pageId || !notionClient || !NOTION_DATABASE_ID) {
    console.log(
      "    ⚠️ Skipping Notion update (no pageId or Notion not configured)"
    );
    return;
  }

  try {
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

    console.log("    ✅ Notion entry updated");
  } catch (error) {
    console.log(`    ⚠️ Failed to update Notion: ${error.message}`);
  }
}

async function updateHistoryEntry(updatedEntry) {
  // Update local history
  const history = JSON.parse(fs.readFileSync("./history.json", "utf-8"));
  const index = history.findIndex((e) => e.id === updatedEntry.id);
  if (index !== -1) {
    history[index] = updatedEntry;
    fs.writeFileSync("./history.json", JSON.stringify(history, null, 2));
  }

  // Update production
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ entries: history });

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
          resolve();
        } else {
          reject(new Error(`Upload failed: ${res.statusCode}`));
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.write(data);
    req.end();
  });
}

async function createShortUrl(fullUrl) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ fullUrl });

    const options = {
      hostname: "automation-mail-zk8t.onrender.com",
      path: "/api/short-urls",
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
        if (res.statusCode === 200 || res.statusCode === 201) {
          const result = JSON.parse(body);
          resolve(result.shortUrl);
        } else {
          // Fallback to full URL if short URL creation fails
          resolve(fullUrl);
        }
      });
    });

    req.on("error", () => resolve(fullUrl)); // Fallback on error
    req.write(data);
    req.end();
  });
}

async function addMeetingProposalsToEmail(emailContent, proposals) {
  const baseUrl = process.env.BASE_URL || "http://localhost:3001";

  // Create booking links
  const bookingLinksPromises = proposals.map(async (proposal) => {
    const bookingUrl = `${baseUrl}/book/${proposal.bookingToken}`;
    try {
      const shortUrl = await createShortUrl(bookingUrl);
      return shortUrl;
    } catch (error) {
      return bookingUrl;
    }
  });

  const bookingLinks = await Promise.all(bookingLinksPromises);

  // Format meeting block with actual dates
  const meetingBlock =
    `\n\nHer har du tre forslag til møter. Trykk på linken for å booke:\n\n` +
    proposals
      .map((proposal, index) => {
        return `${index + 1}. ${proposal.display} - ${bookingLinks[index]}`;
      })
      .join("\n\n");

  // Insert before "Med vennlig hilsen," if present
  if (emailContent && emailContent.includes("Med vennlig hilsen,")) {
    return emailContent.replace(
      "Med vennlig hilsen,",
      `${meetingBlock}\n\nMed vennlig hilsen,`
    );
  } else if (emailContent) {
    // Otherwise append before the end
    return emailContent + meetingBlock;
  }
  return emailContent;
}

async function main() {
  console.log("🔍 Checking for entries missing meeting proposals...\n");

  const history = JSON.parse(fs.readFileSync("./history.json", "utf-8"));
  let proposedMeetings = loadProposedMeetings();

  console.log(
    `📅 Loaded ${proposedMeetings.length} existing proposed meetings\n`
  );

  const missing = history.filter(
    (e) => !e.meetingDates || e.meetingDates.length === 0
  );

  if (missing.length === 0) {
    console.log("✅ All entries have meeting proposals!");
    rl.close();
    return;
  }

  console.log(`Found ${missing.length} entries without meeting proposals:\n`);
  missing.forEach((e, i) => {
    console.log(`${i + 1}. ${e.companyName} (${e.createdAt})`);
  });

  console.log(
    "\n⚠️  This script will generate new meeting proposals for these entries."
  );
  console.log(
    "⚠️  The email content will be updated in both history.json and Notion,"
  );
  console.log("⚠️  but the original emails have already been sent.\n");

  const answer = await question(
    "Do you want to proceed with backfilling? (yes/no): "
  );

  if (answer.toLowerCase() !== "yes") {
    console.log("❌ Aborted");
    rl.close();
    return;
  }

  console.log("\n🚀 Starting backfill process...\n");

  let success = 0;
  let failed = 0;

  for (let i = 0; i < missing.length; i++) {
    const entry = missing[i];
    console.log(
      `\n[${i + 1}/${missing.length}] Processing: ${entry.companyName}`
    );

    try {
      // Generate meeting proposals manually with unique times per entry
      console.log(
        "  📅 Generating meeting proposals (checking for conflicts)..."
      );
      const proposals = generateManualProposals(i, proposedMeetings);

      if (proposals && proposals.length === 3) {
        const meetingDates = proposals.map((p) => p.startISO);

        // Add to proposed meetings to prevent duplicates
        proposedMeetings = addToProposedMeetings(
          proposedMeetings,
          entry.notionPageId,
          entry.companyName,
          meetingDates
        );

        // Create short URLs for booking links
        const baseUrl = process.env.BASE_URL || "https://www.no-offence.io";
        const customerEmail = encodeURIComponent(entry.email || "");
        const customerName = encodeURIComponent(entry.kontaktPerson || "");
        const bookingLinksPromises = proposals.map(async (proposal) => {
          const bookingUrl = `${baseUrl}/book/${proposal.bookingToken}?e=${customerEmail}&n=${customerName}`;
          try {
            return await createShortUrl(bookingUrl);
          } catch (error) {
            console.log("    ⚠️ Couldn't create short URL, using full URL");
            return bookingUrl;
          }
        });

        const bookingLinks = await Promise.all(bookingLinksPromises);

        console.log(`  ✅ Generated ${meetingDates.length} proposals`);

        // Update email content with meeting proposals
        const updatedEmailContent = await addMeetingProposalsToEmail(
          entry.emailContent,
          proposals
        );

        // Update history entry
        const updatedEntry = {
          ...entry,
          meetingDates,
          bookingLinks,
          emailContent: updatedEmailContent,
        };

        // Update history
        console.log("  💾 Updating history...");
        await updateHistoryEntry(updatedEntry);

        // Update Notion entry with new email content
        console.log("  📝 Updating Notion...");
        await updateNotionEntry(entry.notionPageId, updatedEmailContent);

        console.log("  ✅ Updated successfully!");
        success++;

        // Wait 2 seconds between requests to avoid rate limiting
        if (i < missing.length - 1) {
          console.log("  ⏳ Waiting 2s before next entry...");
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } else {
        console.log("  ❌ Failed to generate proposals (invalid response)");
        failed++;
      }
    } catch (error) {
      console.error("  ❌ Error:", error.message);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`\n📊 Backfill complete!`);
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Total: ${missing.length}\n`);

  // Save updated proposed meetings
  console.log("💾 Saving proposed meetings...");
  saveProposedMeetings(proposedMeetings);
  console.log(`✅ Saved ${proposedMeetings.length} proposed meetings\n`);

  rl.close();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  rl.close();
  process.exit(1);
});
