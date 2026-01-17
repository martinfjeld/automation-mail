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

async function regenerateBookingLinks() {
  console.log("🔗 Regenerating all booking links with customer info...\n");

  // Load history
  const history = JSON.parse(fs.readFileSync("history.json", "utf8"));
  const myEmail = process.env.MY_EMAIL || "testeguttene@gmail.com";
  const baseUrl = process.env.BASE_URL || "https://www.no-offence.io";

  let updated = 0;

  for (const entry of history) {
    if (!entry.meetingDates || entry.meetingDates.length === 0) {
      continue;
    }

    console.log(`\n📧 Processing: ${entry.companyName}`);

    const customerEmail = encodeURIComponent(entry.email || "");
    const customerName = encodeURIComponent(entry.contactPerson || "");

    const newBookingLinks = [];

    for (const meetingISO of entry.meetingDates) {
      // Create booking token
      const proposalDate = new Date(meetingISO);
      const endDate = new Date(proposalDate.getTime() + 30 * 60 * 1000); // 30 min later

      const startMs = proposalDate.getTime();
      const endMs = endDate.getTime();
      const customerEmailForToken = entry.email || myEmail; // Use customer email in token
      const tokenData = `${startMs}|${endMs}|${customerEmailForToken}`;
      const bookingToken = Buffer.from(tokenData).toString("base64url");

      // Create booking URL with customer info
      const bookingUrl = `${baseUrl}/book/${bookingToken}?e=${customerEmail}&n=${customerName}`;

      try {
        const shortUrl = await createShortUrl(bookingUrl);
        newBookingLinks.push(shortUrl);
        console.log(`  ✅ Created: ${shortUrl}`);
      } catch (error) {
        console.log(`  ⚠️ Couldn't create short URL: ${error.message}`);
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

regenerateBookingLinks().catch(console.error);
