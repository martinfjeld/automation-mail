require("dotenv").config();
const fs = require("fs");

function updateEmailContent() {
  console.log("📧 Syncing email content with new booking links...\n");

  // Load history
  const history = JSON.parse(fs.readFileSync("history.json", "utf8"));

  let updated = 0;

  for (const entry of history) {
    if (!entry.bookingLinks || entry.bookingLinks.length === 0) {
      continue;
    }

    if (!entry.meetingDates || entry.meetingDates.length === 0) {
      continue;
    }

    console.log(`📧 Processing: ${entry.companyName}`);

    // Format the meeting dates
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

    const formattedMeetings = entry.meetingDates.map((dateISO, index) => {
      const date = new Date(dateISO);
      const dayName = days[date.getDay()];
      const day = date.getDate();
      const month = months[date.getMonth()];
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const endDate = new Date(date.getTime() + 30 * 60 * 1000);
      const endHours = String(endDate.getHours()).padStart(2, "0");
      const endMinutes = String(endDate.getMinutes()).padStart(2, "0");

      return `${
        index + 1
      }. ${dayName} ${day}. ${month}, ${hours}:${minutes}–${endHours}:${endMinutes} - ${
        entry.bookingLinks[index]
      }`;
    });

    // Create the meeting block
    const meetingBlock =
      "\n\nHer har du tre forslag til møter. Trykk på linken for å booke:\n\n" +
      formattedMeetings.join("\n\n");

    // Remove any existing meeting block from email content
    let emailContent = entry.emailContent;

    // Remove everything after "Her har du tre forslag til møter" if it exists
    const meetingStartIndex = emailContent.indexOf(
      "Her har du tre forslag til møter"
    );
    if (meetingStartIndex !== -1) {
      // Find where the email signature starts (before the meeting block)
      const signatureMatch = emailContent.match(/Med vennlig hilsen,?\s*$/m);
      if (signatureMatch && signatureMatch.index < meetingStartIndex) {
        // Keep everything up to before "Med vennlig hilsen"
        emailContent = emailContent.substring(0, signatureMatch.index).trim();
      } else {
        // Just remove the meeting block
        emailContent = emailContent.substring(0, meetingStartIndex).trim();
      }
    } else {
      // No existing meeting block, remove trailing "Med vennlig hilsen" if present
      emailContent = emailContent
        .replace(/\n*Med vennlig hilsen,?\s*$/m, "")
        .trim();
    }

    // Add the new meeting block
    emailContent = emailContent + meetingBlock;

    // Update the entry
    entry.emailContent = emailContent;
    updated++;

    console.log(
      `  ✅ Updated email content with ${entry.bookingLinks.length} meeting links`
    );
  }

  // Save updated history
  fs.writeFileSync("history.json", JSON.stringify(history, null, 2));

  console.log(`\n✅ Updated ${updated} email entries!`);
}

updateEmailContent().catch(console.error);
