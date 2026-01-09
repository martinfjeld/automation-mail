// Backfill missing meeting proposals for history entries
require("dotenv").config();
const fs = require("fs");
const https = require("https");
const readline = require("readline");

const BACKEND_URL = "https://automation-mail-zk8t.onrender.com";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Call production API to generate proposals (no customer email needed)
async function generateMeetingProposalsViaAPI() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "automation-mail-zk8t.onrender.com",
      path: "/api/calendar/generate-proposals", // We need to create this endpoint
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
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`API returned ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.end();
  });
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
    "⚠️  Note: The email content in history will be updated with booking links,"
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
    console.log(`\n[${i + 1}/${missing.length}] Processing: ${entry.companyName}`);

    try {
      // Generate meeting proposals via production API
      console.log("  📅 Generating meeting proposals...");
      const response = await generateMeetingProposalsViaAPI();

      if (response.success && response.proposals && response.proposals.length === 3) {
        const proposals = response.proposals;
        const meetingDates = proposals.map((p) => p.startISO);
        
        // Create short URLs for booking links
        const baseUrl = process.env.BASE_URL || "https://automation-mail-zk8t.onrender.com";
        const bookingLinksPromises = proposals.map(async (proposal) => {
          const bookingUrl = `${baseUrl}/book/${proposal.bookingToken}`;
          try {
            return await createShortUrl(bookingUrl);
          } catch (error) {
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

  rl.close();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  rl.close();
  process.exit(1);
});
