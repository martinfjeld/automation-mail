// Upload local short-urls.json to production backend
const fs = require('fs');
const https = require('https');

const BACKEND_URL = 'https://automation-mail-zk8t.onrender.com';

// Read local file
const localUrls = JSON.parse(fs.readFileSync('./short-urls.json', 'utf-8'));

console.log(`📤 Uploading ${localUrls.length} short URLs to production...`);

// Upload each URL
let uploaded = 0;
let errors = 0;

async function uploadUrl(urlEntry) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ fullUrl: urlEntry.fullUrl });
    
    const options = {
      hostname: 'automation-mail-zk8t.onrender.com',
      path: '/api/short-urls',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          uploaded++;
          console.log(`✅ ${uploaded}/${localUrls.length} - ${urlEntry.code}`);
        } else {
          errors++;
          console.log(`❌ Failed: ${urlEntry.code} (${res.statusCode})`);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      errors++;
      console.error(`❌ Error: ${urlEntry.code} - ${e.message}`);
      resolve();
    });

    req.write(data);
    req.end();
  });
}

async function uploadAll() {
  for (const urlEntry of localUrls) {
    await uploadUrl(urlEntry);
  }
  
  console.log(`\n🎉 Upload complete!`);
  console.log(`✅ Uploaded: ${uploaded}`);
  console.log(`❌ Errors: ${errors}`);
}

uploadAll();
