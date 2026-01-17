// Regenerate ALL meeting proposals with unique times and update proposed-meetings.json
// This ensures no duplicate times across all entries
require("dotenv").config();
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");
const readline = require("readline");

const BACKEND_URL = "https://automation-mail-zk8t.onrender.com";

const { Client } = require("@notionhq/client");
const notionClient = new Client({ auth: process.env.NOTION_TOKEN });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

// Load proposed meetings
function loadProposedMeetings() {
  try {
    return JSON.parse(fs.readFileSync("./proposed-meetings.json", "utf-8"));
  } catch (error) {
    return [];
  }
}

// Check if time is taken
function isTimeSlotTaken(proposedMeetings, timeISO) {
  return proposedMeetings.some(
    (pm) => pm.meetingTimes && pm.meetingTimes.includes(timeISO)
  );
}

// Generate unique proposals
function generateManualProposals(entryIndex, proposedMeetings) {
  const now = new Date();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const daysOffset = Math.floor(entryIndex / 8);
  const startDate = new Date(
    now.getTime() + oneWeek + daysOffset * 24 * 60 * 60 * 1000
  );

  const proposals = [];
  const baseHours = [9, 11, 14];

  let attempts = 0;
  const maxAttempts = 100;

  while (proposals.length < 3 && attempts < maxAttempts) {
    attempts++;
    const i = proposals.length;
    const proposalDate = new Date(
      startDate.getTime() +
        i * 24 * 60 * 60 * 1000 +
        (attempts - 1) * 60 * 60 * 1000
    );

    const hours =
      (baseHours[i] + (entryIndex % 3) + Math.floor((attempts - 1) / 4)) % 24;
    const minutes = ((entryIndex % 4) * 15 + ((attempts - 1) % 4) * 15) % 60;

    proposalDate.setHours(hours, minutes, 0, 0);

    if (isTimeSlotTaken(proposedMeetings, proposalDate.toISOString())) {
      continue;
    }

    const endDate = new Date(proposalDate.getTime() + 30 * 60 * 1000);
    const bookingData = {
      startISO: proposalDate.toISOString(),
      endISO: endDate.toISOString(),
    };
    const bookingToken = Buffer.from(JSON.stringify(bookingData)).toString(
      "base64"
    );

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

async function createShortUrl(longUrl) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ fullUrl: longUrl });
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
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function addMeetingProposalsToEmail(
  emailContent,
  proposals,
  bookingLinks
) {
  const meetingBlock =
    "\n\nHer har du tre forslag til møter. Trykk på linken for å booke:\n\n" +
    proposals
      .map((proposal, index) => {
        return `${index + 1}. ${proposal.display} - ${bookingLinks[index]}`;
      })
      .join("\n\n");

  if (emailContent && emailContent.includes("Med vennlig hilsen,")) {
    return emailContent.replace(
      "Med vennlig hilsen,",
      `${meetingBlock}\n\nMed vennlig hilsen,`
    );
  } else if (emailContent) {
    return emailContent + meetingBlock;
  }
  return emailContent;
}

async function updateNotionEntry(pageId, emailContent) {
  if (!pageId) return;

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
  } catch (error) {
    console.log(`    ⚠️ Notion update failed: ${error.message}`);
  }
}

async function main() {
  console.log("🔄 REGENERATING ALL MEETING PROPOSALS\n");
  console.log("⚠️  This will:");
  console.log("   1. Generate unique meeting times for ALL entries");
  console.log("   2. Update history.json with new times and booking links");
  console.log("   3. Rebuild proposed-meetings.json from scratch");
  console.log("   4. Update all Notion entries with new email content\n");

  const answer = await question("Are you sure? (yes/no): ");
  if (answer.toLowerCase() !== "yes") {
    console.log("❌ Aborted");
    rl.close();
    return;
  }

  const history = JSON.parse(fs.readFileSync("./history.json", "utf-8"));
  let proposedMeetings = [];

  console.log(`\n📋 Processing ${history.length} entries...\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    console.log(`[${i + 1}/${history.length}] ${entry.companyName}`);

    try {
      const proposals = generateManualProposals(i, proposedMeetings);

      if (proposals && proposals.length === 3) {
        const meetingDates = proposals.map((p) => p.startISO);

        // Add to proposed meetings
        proposedMeetings.push({
          notionPageId: entry.notionPageId,
          companyName: entry.companyName,
          meetingTimes: meetingDates,
        });

        const baseUrl =
          process.env.BASE_URL || "https://automation-mail-zk8t.onrender.com";
        const bookingLinksPromises = proposals.map(async (proposal) => {
          const bookingUrl = `${baseUrl}/book/${proposal.bookingToken}`;
          try {
            return await createShortUrl(bookingUrl);
          } catch (error) {
            return bookingUrl;
          }
        });

        const bookingLinks = await Promise.all(bookingLinksPromises);

        const updatedEmailContent = await addMeetingProposalsToEmail(
          entry.emailContent,
          proposals,
          bookingLinks
        );

        // Update entry
        entry.meetingDates = meetingDates;
        entry.bookingLinks = bookingLinks;
        entry.emailContent = updatedEmailContent;

        // Update Notion
        await updateNotionEntry(entry.notionPageId, updatedEmailContent);

        console.log(
          `  ✅ ${proposals[0].display.split(",")[0]}, ${
            proposals[1].display.split(",")[0]
          }, ${proposals[2].display.split(",")[0]}`
        );
        success++;

        // Delay to avoid rate limits
        if (i < history.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } else {
        console.log("  ❌ Failed to generate proposals");
        failed++;
      }
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      failed++;
    }
  }

  console.log("\n💾 Saving files...");
  fs.writeFileSync("./history.json", JSON.stringify(history, null, 2));
  fs.writeFileSync(
    "./proposed-meetings.json",
    JSON.stringify(proposedMeetings, null, 2)
  );

  // Upload to production
  console.log("📤 Uploading to production...");
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

  await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve());
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });

  console.log("\n" + "=".repeat(50));
  console.log(`\n✅ Complete!`);
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📅 Proposed meetings: ${proposedMeetings.length}\n`);

  rl.close();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  rl.close();
  process.exit(1);
});
