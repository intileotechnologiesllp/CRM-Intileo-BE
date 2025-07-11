const { htmlToText } = require("html-to-text");

// Test the improved cleanEmailBody function
const cleanEmailBody = (body) => {
  if (!body) return "";

  // First, use html-to-text for comprehensive HTML-to-text conversion
  const cleanText = htmlToText(body, {
    wordwrap: false,
    ignoreHref: true,
    ignoreImage: true,
    uppercaseHeadings: false,
    preserveNewlines: false,
    selectors: [
      // Remove VML (Vector Markup Language) content
      { selector: "v\\:*", format: "skip" },
      { selector: "o\\:*", format: "skip" },
      // Remove style tags and their content
      { selector: "style", format: "skip" },
      // Remove script tags and their content
      { selector: "script", format: "skip" },
      // Remove tracking pixels and small images
      { selector: 'img[width="1"]', format: "skip" },
      { selector: 'img[height="1"]', format: "skip" },
      // Keep important content as text
      { selector: "a", options: { ignoreHref: true } },
      { selector: "div", format: "block" },
      { selector: "p", format: "block" },
      { selector: "br", format: "lineBreak" },
    ],
  });

  // Remove quoted replies (e.g., lines starting with ">")
  const withoutQuotes = cleanText
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("\n");

  // Additional cleanup for any remaining HTML entities or special characters
  const finalClean = withoutQuotes
    .replace(/&[a-zA-Z0-9#]+;/g, " ") // HTML entities
    .replace(/\s+/g, " ") // Multiple spaces
    .trim();

  return finalClean;
};

// Test with complex HTML email
const testHtml = `
<html>
<head>
<style>
v\\:* {behavior:url(#default#VML);}
o\\:* {behavior:url(#default#VML);}
.MsoNormal {margin:0;}
</style>
</head>
<body>
<div>
<p>Hello, this is a test email with <b>bold text</b> and <i>italic text</i>.</p>
<p>This email contains VML content and CSS styling.</p>
<v:rect style="width:100px;height:50px;">
<v:fill color="red" />
</v:rect>
<o:p>&nbsp;</o:p>
<div style="color: blue; font-size: 14px;">
This is a styled div with <a href="https://example.com">a link</a>.
</div>
<img src="tracking.gif" width="1" height="1" />
</div>
</body>
</html>
`;

console.log("Original HTML:");
console.log(testHtml);
console.log("\n" + "=".repeat(50) + "\n");

console.log("Cleaned email body:");
console.log(cleanEmailBody(testHtml));
console.log("\n" + "=".repeat(50) + "\n");

// Test with plain text
const plainText =
  "This is a plain text email.\n> This is a quoted reply.\nThis is not quoted.";
console.log("Plain text input:");
console.log(plainText);
console.log("\nCleaned plain text:");
console.log(cleanEmailBody(plainText));
