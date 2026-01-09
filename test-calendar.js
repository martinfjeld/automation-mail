const { CalendarService } = require('./build/server/services/calendarService');

async function test() {
  try {
    console.log('🧪 Testing Google Calendar API...\n');
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const myEmail = process.env.MY_EMAIL;

    if (!clientId || !clientSecret || !refreshToken || !myEmail) {
      console.error('❌ Missing environment variables!');
      console.log('Required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, MY_EMAIL');
      return;
    }

    console.log('✅ Environment variables found');
    console.log(`   Email: ${myEmail}`);
    console.log(`   Client ID: ${clientId.substring(0, 20)}...`);
    console.log('');

    const cal = new CalendarService(clientId, clientSecret, refreshToken);
    
    const earliestStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const latestEnd = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
    
    console.log('📅 Generating proposals...');
    const proposals = await cal.generateProposals(earliestStart, latestEnd, myEmail, []);
    
    console.log(`\n✅ Success! Generated ${proposals.length} proposals:`);
    proposals.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.display}`);
    });
  } catch (error) {
    console.error('\n❌ Calendar API test failed!');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

test();
