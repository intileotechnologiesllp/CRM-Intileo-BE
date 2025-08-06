const Imap = require("imap-simple");

const testBatchLogic = async () => {
  try {
    const imapConfig = {
      imap: {
        user: "mridul.kumar@intileo.com",
        password: "pyunogctsxecsovz",
        host: "imap.yandex.com",
        port: 993,
        tls: true,
        authTimeout: 30000,
        tlsOptions: { rejectUnauthorized: false },
      },
    };

    console.log("🔧 Testing fixed batch logic...");
    const connection = await Imap.connect(imapConfig);
    await connection.openBox("INBOX");

    // Get all UIDs
    const allMessages = await connection.search(["ALL"], {
      bodies: [],
      struct: true,
    });
    const allUIDs = allMessages
      .map((msg) => msg.attributes.uid)
      .sort((a, b) => a - b);

    console.log(`📊 Total emails: ${allUIDs.length}`);
    console.log(
      `📋 All UIDs: [${allUIDs.slice(0, 10).join(",")}...${allUIDs
        .slice(-5)
        .join(",")}]`
    );

    // Test batch 1: UIDs 1-25
    const batch1UIDs = allUIDs.slice(0, 25);
    console.log(
      `\n🧪 Testing Batch 1 (UIDs ${batch1UIDs[0]}-${batch1UIDs[24]}):`
    );

    // Test the corrected UID range search
    const isConsecutive = batch1UIDs.every(
      (uid, i) => i === 0 || uid === batch1UIDs[i - 1] + 1
    );
    console.log(`   - Is consecutive: ${isConsecutive}`);

    if (isConsecutive) {
      const rangeSearch = await connection.search(
        [["UID", `${batch1UIDs[0]}:${batch1UIDs[24]}`]],
        { bodies: "HEADER", struct: true }
      );
      console.log(
        `   - UID RANGE search (${batch1UIDs[0]}:${batch1UIDs[24]}): Found ${rangeSearch.length} emails`
      );
      console.log(
        `   - First few UIDs found: [${rangeSearch
          .slice(0, 5)
          .map((m) => m.attributes.uid)
          .join(",")}]`
      );
    }

    // Test batch 2: UIDs 26-50
    const batch2UIDs = allUIDs.slice(25, 50);
    console.log(
      `\n🧪 Testing Batch 2 (UIDs ${batch2UIDs[0]}-${batch2UIDs[24]}):`
    );
    const isConsecutive2 = batch2UIDs.every(
      (uid, i) => i === 0 || uid === batch2UIDs[i - 1] + 1
    );
    console.log(`   - Is consecutive: ${isConsecutive2}`);

    if (isConsecutive2) {
      const rangeSearch2 = await connection.search(
        [["UID", `${batch2UIDs[0]}:${batch2UIDs[24]}`]],
        { bodies: "HEADER", struct: true }
      );
      console.log(
        `   - UID RANGE search (${batch2UIDs[0]}:${batch2UIDs[24]}): Found ${rangeSearch2.length} emails`
      );
      console.log(
        `   - First few UIDs found: [${rangeSearch2
          .slice(0, 5)
          .map((m) => m.attributes.uid)
          .join(",")}]`
      );
    }

    await connection.end();
    console.log("\n✅ Batch logic test completed!");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
};

testBatchLogic();
