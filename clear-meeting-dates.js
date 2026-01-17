/**
 * Remove all møtedato fields from history.json
 */

const fs = require("fs");

console.log("🗑️  Clearing all møtedato fields from history.json...\n");

// Read history
const history = JSON.parse(fs.readFileSync("./history.json", "utf-8"));

console.log(`📊 Total entries: ${history.length}`);

// Count entries with møtedato
const entriesWithMeetingDate = history.filter((e) => e.møtedato).length;
console.log(`📅 Entries with møtedato: ${entriesWithMeetingDate}\n`);

// Remove møtedato from all entries
history.forEach((entry) => {
  if (entry.møtedato) {
    delete entry.møtedato;
  }
});

// Save back to file
fs.writeFileSync("./history.json", JSON.stringify(history, null, 2));

console.log("✅ Cleared all møtedato fields!");
console.log(
  "💾 Saved to history.json - now run upload-history.js to sync to production\n"
);
