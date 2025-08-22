const Imap = require('imap-simple');
const { simpleParser } = require('mailparser');
const UserCredential = require('./models/email/userCredentialModel');

// Test IMAP body fetching using real database credentials
const testImapWithDbCredentials = async () => {
  console.log('🚀 Starting IMAP Body Fetch Test with DB credentials...');
  
  try {
    // Get credentials from database (Gmail user)
    console.log('🔍 Fetching credentials for masterUserID 53 (Gmail)...');
    const userCredential = await UserCredential.findOne({
      where: { masterUserID: 53 }
    });
    
    if (!userCredential) {
      console.error('❌ No credentials found for user 53');
      return;
    }
    
    console.log(`✅ Found credentials: ${userCredential.email} (${userCredential.provider})`);
    
    // Set up IMAP config
    const imapConfig = {
      imap: {
        user: userCredential.email,
        password: userCredential.appPassword,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 30000,
        tlsOptions: { rejectUnauthorized: false },
        keepalive: true,
      },
    };
    
    console.log('🔌 Connecting to Gmail IMAP...');
    const connection = await Imap.connect(imapConfig);
    console.log('✅ Connected successfully!');
    
    console.log('📂 Opening INBOX...');
    await connection.openBox('INBOX');
    console.log('✅ INBOX opened!');
    
    // Test with the problematic UID
    const testUID = 30948;
    const searchCriteria = [['UID', testUID]];
    
    console.log(`\n🔍 Testing UID: ${testUID}`);
    
    // Method 1: Try the node-imap direct approach (bypass imap-simple search)
    console.log('\n--- Method 1: Direct node-imap fetch ---');
    try {
      // Get the underlying node-imap connection
      const nodeImapConnection = connection.imap;
      
      console.log('🔧 Trying direct UID FETCH...');
      
      // Try different fetch commands directly
      const fetchCommands = [
        'BODY[]',
        'BODY.PEEK[]',
        'RFC822',
        'BODY[1]',
        'BODY[1.1]',
        'BODY[1.2]',
        'BODY.PEEK[1.1]',
        'BODY.PEEK[1.2]'
      ];
      
      for (const cmd of fetchCommands) {
        try {
          console.log(`🔧 Trying: UID FETCH ${testUID} (${cmd})`);
          
          const fetchResult = await new Promise((resolve, reject) => {
            nodeImapConnection.fetch([testUID], {
              bodies: cmd,
              struct: false
            }, (err, results) => {
              if (err) {
                reject(err);
                return;
              }
              
              const messages = [];
              results.on('message', (msg) => {
                let body = '';
                msg.on('body', (stream) => {
                  stream.on('data', (chunk) => {
                    body += chunk.toString();
                  });
                });
                msg.once('end', () => {
                  messages.push({ body });
                });
              });
              
              results.once('error', reject);
              results.once('end', () => {
                resolve(messages);
              });
            });
          });
          
          if (fetchResult && fetchResult.length > 0 && fetchResult[0].body) {
            const body = fetchResult[0].body;
            console.log(`✅ ${cmd} SUCCESS: ${body.length} chars`);
            console.log(`📄 Preview:`, body.substring(0, 200));
            
            // Try parsing if it looks like a full email
            if (body.length > 500 && body.includes('Content-Type')) {
              console.log(`🔧 Parsing with mailparser...`);
              try {
                const parsed = await simpleParser(body);
                console.log(`✅ Parsed! Text: ${parsed.text?.length || 0}, HTML: ${parsed.html?.length || 0}`);
                
                if (parsed.text || parsed.html) {
                  console.log(`\n🎉 SUCCESS! Method "${cmd}" works!`);
                  console.log(`📝 Text content:`, (parsed.text || '').substring(0, 300));
                  // Found working method, break
                  break;
                }
              } catch (parseErr) {
                console.log(`❌ Parse error:`, parseErr.message);
              }
            }
          } else {
            console.log(`⚠️ ${cmd}: No body returned`);
          }
          
        } catch (fetchErr) {
          console.log(`❌ ${cmd} ERROR:`, fetchErr.message);
        }
      }
      
    } catch (directError) {
      console.error('❌ Direct fetch failed:', directError.message);
    }
    
    // Method 2: Try with imap-simple but different syntax
    console.log('\n--- Method 2: imap-simple with corrected syntax ---');
    
    const simpleMethods = [
      { name: 'bodies as string', options: { bodies: 'BODY[]' } },
      { name: 'bodies as array', options: { bodies: ['BODY[]'] } },
      { name: 'fetchOptions format', options: { fetchOptions: { bodies: 'BODY[]' } } },
    ];
    
    for (const method of simpleMethods) {
      try {
        console.log(`🔧 Testing imap-simple: ${method.name}`);
        const results = await connection.search(searchCriteria, method.options);
        
        if (results && results.length > 0) {
          console.log(`✅ ${method.name}: Got results`);
          console.log('📋 Keys:', Object.keys(results[0]));
          
          if (results[0].bodies) {
            console.log('📋 Body keys:', Object.keys(results[0].bodies));
          }
        } else {
          console.log(`⚠️ ${method.name}: No results`);
        }
      } catch (error) {
        console.log(`❌ ${method.name} ERROR:`, error.message);
      }
    }
    
    console.log('\n🔌 Closing connection...');
    connection.end();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
};

// Run the test
console.log('🧪 IMAP Body Fetch Test with DB Credentials Starting...');
console.log('📝 This will test various methods using your actual database credentials');
console.log('─'.repeat(50));

testImapWithDbCredentials().catch(console.error);
