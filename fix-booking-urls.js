require("dotenv").config();
const fs = require("fs");
const axios = require("axios");

async function createShortUrl(fullUrl) {
  try {
    const response = await axios.post(
      `${process.env.BACKEND_URL}/api/short-urls`,
      { fullUrl },
      { headers: { "Content-Type": "application/json" } }
    );

    if (response.status === 200 || response.status === 201) {
      return response.data.shortUrl;
    }
    throw new Error(`Unexpected status: ${response.status}`);
  } catch (error) {
    throw new Error(`Failed to create short URL: ${error.message}`);
  }
}

async function fixBookingUrls() {
  console.log("🔗 Fixing booking URLs with customer info...\n");

  // Load history
  const history = JSON.parse(fs.readFileSync("history.json", "utf8"));

  // Find entries with booking links
  const entriesWithLinks = history.filter(
    (entry) => entry.bookingLinks && entry.bookingLinks.length > 0
  );

  console.log(`Found ${entriesWithLinks.length} entries with booking links\n`);

  let updated = 0;

  for (const entry of entriesWithLinks) {
    console.log(`\n📧 Processing: ${entry.name} (${entry.code})`);

    // Extract tokens from existing booking links by expanding the short URLs
    // For now, let's reconstruct from meetingDates since we have the tokens there
    if (!entry.meetingDates || entry.meetingDates.length === 0) {
      console.log("  ⚠️ No meeting dates found, skipping");
      continue;
    }

    const baseUrl =
      process.env.BACKEND_URL || "https://automation-mail-zk8t.onrender.com";
    const customerEmail = encodeURIComponent(entry.email || "");
    const customerName = encodeURIComponent(entry.kontaktPerson || "");

    const newBookingLinks = [];

    for (const meeting of entry.meetingDates) {
      if (!meeting.bookingToken) {
        console.log("  ⚠️ Meeting missing booking token");
        continue;
      }

      const bookingUrl = `${baseUrl}/book/${meeting.bookingToken}?e=${customerEmail}&n=${customerName}`;

      try {
        const shortUrl = await createShortUrl(bookingUrl);
        newBookingLinks.push(shortUrl);
        console.log(`  ✅ Created: ${shortUrl}`);
      } catch (error) {
        console.log(`  ⚠️ Couldn't create short URL, using full URL`);
        newBookingLinks.push(bookingUrl);
      }
    }

    // Update the entry
    entry.bookingLinks = newBookingLinks;
    updated++;

    console.log(`  ✅ Updated ${newBookingLinks.length} booking links`);
  }

  // Save updated history
  fs.writeFileSync("history.json", JSON.stringify(history, null, 2));

  console.log(`\n✅ Updated ${updated} entries!`);
}

fixBookingUrls().catch(console.error);
