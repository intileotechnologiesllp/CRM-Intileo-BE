const Imap = require("imap-simple");

const testInboxDirect = async () => {
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

    console.log("Connecting to IMAP...");
    const connection = await Imap.connect(imapConfig);
    await connection.openBox("INBOX");

    console.log("Searching for ALL messages...");
    const allMessages = await connection.search(["ALL"], {
      bodies: [],
      struct: true,
    });

    console.log(`📊 INBOX REALITY CHECK:`);
    console.log(`  - Total messages found: ${allMessages.length}`);

    if (allMessages.length > 0) {
      console.log(`\n🔍 FIRST 10 ACTUAL MESSAGES:`);
      for (let i = 0; i < Math.min(10, allMessages.length); i++) {
        const msg = allMessages[i];
        console.log(
          `  ${i + 1}. UID=${msg.attributes?.uid}, Date=${
            msg.attributes?.date
          }, Size=${msg.attributes?.size}, Flags=${
            msg.attributes?.flags?.join(",") || "none"
          }`
        );
      }

      if (allMessages.length > 10) {
        console.log(`\n🔍 LAST 10 ACTUAL MESSAGES:`);
        for (
          let i = Math.max(0, allMessages.length - 10);
          i < allMessages.length;
          i++
        ) {
          const msg = allMessages[i];
          const actualIndex = i + 1;
          console.log(
            `  ${actualIndex}. UID=${msg.attributes?.uid}, Date=${
              msg.attributes?.date
            }, Size=${msg.attributes?.size}, Flags=${
              msg.attributes?.flags?.join(",") || "none"
            }`
          );
        }
      }

      // Extract actual UIDs
      const realUIDs = allMessages
        .map((msg) => msg.attributes?.uid)
        .filter((uid) => uid)
        .sort((a, b) => a - b);

      console.log(`\n📋 ACTUAL UIDs IN INBOX: [${realUIDs.join(",")}]`);
      console.log(
        `📋 UID RANGE: ${realUIDs[0]} to ${realUIDs[realUIDs.length - 1]}`
      );
      console.log(
        `📋 GAPS IN SEQUENCE: ${
          realUIDs[realUIDs.length - 1] - realUIDs[0] + 1 - realUIDs.length
        } missing UIDs`
      );
    } else {
      console.log(`❌ NO MESSAGES FOUND IN INBOX!`);
    }

    await connection.end();
    console.log("✅ Test completed");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
};

testInboxDirect();
