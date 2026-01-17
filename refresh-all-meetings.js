/**
 * Refresh all meeting dates and booking links
 * - Generate new dates starting 1 week from today
 * - Create new booking tokens with customer emails
 * - Update email content with new meeting times
 */

require("dotenv").config();
const fs = require("fs");
const axios = require("axios");

const BACKEND_URL = process.env.BACKEND_URL || "https://automation-mail-zk8t.onrender.com";
const BASE_URL = process.env.BASE_URL || "https://www.no-offence.io";

async function createShortUrl(fullUrl) {
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/short-urls`,
      { fullUrl },
      { headers: { "Content-Type": "application/json" } }
    );

    if (response.status === 200 || response.status === 201) {
      return response.data.shortUrl;
    }
    throw new Error(`Unexpected status: ${response.status}`);
  } catch (error) {
    console.log(`    ⚠️  Short URL failed: ${error.message}`);
    return fullUrl;
  }
}

// Generate 3 meeting proposals starting 1 week from today
function generateNewMeetingDates(entryIndex) {
  const now = new Date();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  
  // Start 1 week from today
  const startDate = new Date(now.getTime() + oneWeek);
  
  // Add days offset based on entry index to spread meetings
  const daysOffset = Math.floor(entryIndex / 8); // Group every 8 entries into same week
  
  const proposals = [];
  const baseHours = [10, 13, 15]; // 10am, 1pm, 3pm
  
  for (let i = 0; i < 3; i++) {
    const proposalDate = new Date(startDate.getTime() + (i + daysOffset) * 24 * 60 * 60 * 1000);
    
    // Vary hours slightly based on entry index
    const hours = baseHours[i] + (entryIndex % 3);
    const minutes = (entryIndex % 4) * 15;
    
    // Set to weekday (skip weekends)
    while (proposalDate.getDay() === 0 || proposalDate.getDay() === 6) {
      proposalDate.setDate(proposalDate.getDate() + 1);
    }
    
    proposalDate.setHours(hours, minutes, 0, 0);
    
    const endDate = new Date(proposalDate.getTime() + 30 * 60 * 1000);
    
    proposals.push({
      startISO: proposalDate.toISOString(),
      endISO: endDate.toISOString(),
      display: formatMeetingDisplay(proposalDate, endDate)
    });
  }
  
  return proposals;
}

function formatMeetingDisplay(start, end) {
  const days = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];
  const months = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
  
  const dayName = days[start.getDay()];
  const day = start.getDate();
  const month = months[start.getMonth()];
  
  const startTime = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
  const endTime = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
  
  return `${dayName} ${day}. ${month}, ${startTime}–${endTime}`;
}

function updateEmailContent(emailContent, proposals, bookingLinks) {
  // Remove old meeting proposals section if it exists
  let updatedContent = emailContent;
  
  // Find and remove the old meeting section
  const meetingRegex = /\n\nHer har du tre forslag til møter.*?\n\nMed vennlig hilsen,/s;
  if (meetingRegex.test(updatedContent)) {
    updatedContent = updatedContent.replace(meetingRegex, "\n\nMed vennlig hilsen,");
  }
  
  // Create new meeting block
  const meetingBlock = `\n\nHer har du tre forslag til møter. Trykk på linken for å booke:\n\n` +
    proposals.map((proposal, index) => 
      `${index + 1}. ${proposal.display} - ${bookingLinks[index]}`
    ).join("\n\n");
  
  // Insert before "Med vennlig hilsen,"
  if (updatedContent.includes("Med vennlig hilsen,")) {
    updatedContent = updatedContent.replace(
      "Med vennlig hilsen,",
      `${meetingBlock}\n\nMed vennlig hilsen,`
    );
  } else {
    updatedContent += meetingBlock + "\n\nMed vennlig hilsen,";
  }
  
  return updatedContent;
}

async function refreshAllMeetings() {
  console.log("🔄 Refreshing all meetings with new dates...\n");
  console.log(`📅 Starting from: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}\n`);
  
  // Load history
  const history = JSON.parse(fs.readFileSync("./history.json", "utf-8"));
  
  let updated = 0;
  let skipped = 0;
  
  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    
    // Skip entries without email or meeting dates
    if (!entry.email || !entry.meetingDates || entry.meetingDates.length === 0) {
      skipped++;
      continue;
    }
    
    console.log(`\n[${i + 1}/${history.length}] 📧 ${entry.companyName}`);
    
    try {
      // Generate new meeting dates
      const proposals = generateNewMeetingDates(i);
      const meetingDates = proposals.map(p => p.startISO);
      
      console.log(`  📅 New dates: ${proposals[0].display}, ${proposals[1].display}, ${proposals[2].display}`);
      
      // Create booking tokens with customer email
      const customerEmail = encodeURIComponent(entry.email);
      const customerName = encodeURIComponent(entry.contactPerson || "");
      
      const bookingLinksPromises = proposals.map(async (proposal) => {
        const startMs = new Date(proposal.startISO).getTime();
        const endMs = new Date(proposal.endISO).getTime();
        const tokenData = `${startMs}|${endMs}|${entry.email}`;
        const bookingToken = Buffer.from(tokenData).toString("base64url");
        
        const bookingUrl = `${BASE_URL}/book/${bookingToken}?e=${customerEmail}&n=${customerName}`;
        return await createShortUrl(bookingUrl);
      });
      
      const bookingLinks = await Promise.all(bookingLinksPromises);
      console.log(`  🔗 Created ${bookingLinks.length} booking links`);
      
      // Update email content
      const updatedEmailContent = updateEmailContent(
        entry.emailContent || "",
        proposals,
        bookingLinks
      );
      
      // Update entry
      entry.meetingDates = meetingDates;
      entry.bookingLinks = bookingLinks;
      entry.emailContent = updatedEmailContent;
      
      // Remove old meeting confirmation if exists
      delete entry.møtedato;
      delete entry.bookedSlotIndex;
      
      console.log(`  ✅ Updated successfully`);
      updated++;
      
      // Small delay to avoid rate limiting
      if (i < history.length - 1 && i % 10 === 0) {
        console.log("\n  ⏳ Pausing 2s...");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  // Save updated history
  fs.writeFileSync("./history.json", JSON.stringify(history, null, 2));
  
  console.log("\n" + "=".repeat(60));
  console.log(`\n✅ Refresh complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${history.length}\n`);
  console.log("💾 Saved to history.json");
  console.log("🚀 Run 'node upload-history.js' to sync to production\n");
}

refreshAllMeetings().catch(console.error);
