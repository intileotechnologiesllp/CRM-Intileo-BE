const fs = require('fs');
const path = require('path');

// Files to clean
const filesToClean = [
  'ecosystem.config.js',
  'ecosystem.prod.config.js',
  'config.testcredential.js'
];

// Credentials to replace with env var references
const replacements = [
  {
    find: /EMAIL_USER:\s*"[^"]*"/g,
    replace: 'EMAIL_USER: process.env.EMAIL_USER'
  },
  {
    find: /EMAIL_PASS:\s*"[^"]*"/g,
    replace: 'EMAIL_PASS: process.env.EMAIL_PASS'
  },
  {
    find: /SENDER_EMAIL:\s*"[^"]*"/g,
    replace: 'SENDER_EMAIL: process.env.SENDER_EMAIL'
  },
  {
    find: /SENDER_PASSWORD:\s*"[^"]*"/g,
    replace: 'SENDER_PASSWORD: process.env.SENDER_PASSWORD'
  }
];

console.log('🔒 Removing hardcoded SMTP credentials...\n');

filesToClean.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  replacements.forEach(({ find, replace }) => {
    if (content.match(find)) {
      content = content.replace(find, replace);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Cleaned: ${file}`);
  } else {
    console.log(`ℹ️  No changes needed: ${file}`);
  }
});

console.log('\n✅ All files cleaned! Now commit these changes.');
