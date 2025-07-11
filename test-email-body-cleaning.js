const { htmlToText } = require("html-to-text");

// Test the improved email body cleaning functions
const cleanEmailBody = (body) => {
  if (!body) return "";

  let cleanBody = body;

  // Use html-to-text for robust HTML conversion
  try {
    if (body.includes("<") && body.includes(">")) {
      // This looks like HTML, use html-to-text for better conversion
      cleanBody = htmlToText(body, {
        wordwrap: false,
        ignoreHref: true,
        ignoreImage: true,
        preserveNewlines: true,
        uppercaseHeadings: false,
        hideLinkHrefIfSameAsText: true,
        noLinkBrackets: true,
        formatters: {
          // Custom formatter to handle VML and CSS blocks
          vmlBlock: function (elem, walk, builder, formatOptions) {
            return "";
          },
          styleBlock: function (elem, walk, builder, formatOptions) {
            return "";
          },
        },
        selectors: [
          // Ignore VML and style blocks completely
          { selector: "v\\:*", format: "skip" },
          { selector: "o\\:*", format: "skip" },
          { selector: "style", format: "skip" },
          { selector: "script", format: "skip" },
          { selector: "head", format: "skip" },
          { selector: "title", format: "skip" },
          { selector: "meta", format: "skip" },
          { selector: "link", format: "skip" },
          // Format common elements
          { selector: "p", format: "paragraph" },
          { selector: "br", format: "lineBreak" },
          { selector: "div", format: "block" },
          { selector: "span", format: "inline" },
          { selector: "table", format: "table" },
          { selector: "tr", format: "tableRow" },
          { selector: "td", format: "tableCell" },
          { selector: "th", format: "tableCell" },
          { selector: "ul", format: "unorderedList" },
          { selector: "ol", format: "orderedList" },
          { selector: "li", format: "listItem" },
        ],
      });
    }
  } catch (htmlError) {
    console.log(
      "HTML-to-text conversion failed, falling back to regex cleanup:",
      htmlError.message
    );
    // Fall back to regex if html-to-text fails
    cleanBody = body.replace(/<[^>]*>/g, "");
  }

  // Additional cleanup for any remaining VML/CSS artifacts
  cleanBody = cleanBody.replace(/v\\\*\s*\{[^}]*\}/g, "");
  cleanBody = cleanBody.replace(/o\\\*\s*\{[^}]*\}/g, "");
  cleanBody = cleanBody.replace(/\{[^}]*behavior:[^}]*\}/g, "");
  cleanBody = cleanBody.replace(/\{[^}]*url\([^)]*\)[^}]*\}/g, "");
  cleanBody = cleanBody.replace(/\{[^}]*\}/g, ""); // Remove any remaining CSS blocks

  // Remove HTML entities and encoded characters
  cleanBody = cleanBody.replace(/&[a-zA-Z0-9#]+;/g, " ");
  cleanBody = cleanBody.replace(/\\[a-zA-Z0-9]+/g, " ");
  cleanBody = cleanBody.replace(/v\\\*/g, "");
  cleanBody = cleanBody.replace(/o\\\*/g, "");

  // Remove quoted replies (e.g., lines starting with ">")
  cleanBody = cleanBody
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join("\n");

  // Clean up extra whitespace and special characters
  cleanBody = cleanBody.replace(/[{}[\]]/g, " ");
  cleanBody = cleanBody.replace(/\s+/g, " ").trim();

  return cleanBody;
};

// Helper function to create email body preview
const createBodyPreview = (body, maxLength = 120) => {
  if (!body) return "";

  let cleanBody = body;

  // Use html-to-text for robust HTML conversion
  try {
    if (body.includes("<") && body.includes(">")) {
      // This looks like HTML, use html-to-text for better conversion
      cleanBody = htmlToText(body, {
        wordwrap: false,
        ignoreHref: true,
        ignoreImage: true,
        preserveNewlines: false,
        uppercaseHeadings: false,
        hideLinkHrefIfSameAsText: true,
        noLinkBrackets: true,
        formatters: {
          // Custom formatter to handle VML and CSS blocks
          vmlBlock: function (elem, walk, builder, formatOptions) {
            return "";
          },
          styleBlock: function (elem, walk, builder, formatOptions) {
            return "";
          },
        },
        selectors: [
          // Ignore VML and style blocks completely
          { selector: "v\\:*", format: "skip" },
          { selector: "o\\:*", format: "skip" },
          { selector: "style", format: "skip" },
          { selector: "script", format: "skip" },
          { selector: "head", format: "skip" },
          { selector: "title", format: "skip" },
          { selector: "meta", format: "skip" },
          { selector: "link", format: "skip" },
          // Format common elements to preserve structure
          { selector: "p", format: "paragraph" },
          { selector: "br", format: "lineBreak" },
          { selector: "div", format: "block" },
          { selector: "span", format: "inline" },
        ],
      });
    }
  } catch (htmlError) {
    console.log(
      "HTML-to-text conversion failed in preview, falling back to regex cleanup:",
      htmlError.message
    );
    // Fall back to regex if html-to-text fails
    cleanBody = body.replace(/<[^>]*>/g, "");
  }

  // Additional cleanup for any remaining VML/CSS artifacts
  cleanBody = cleanBody.replace(/v\\\*\s*\{[^}]*\}/g, "");
  cleanBody = cleanBody.replace(/o\\\*\s*\{[^}]*\}/g, "");
  cleanBody = cleanBody.replace(/\{[^}]*behavior:[^}]*\}/g, "");
  cleanBody = cleanBody.replace(/\{[^}]*url\([^)]*\)[^}]*\}/g, "");
  cleanBody = cleanBody.replace(/\{[^}]*\}/g, ""); // Remove any remaining CSS blocks

  // Remove HTML entities and encoded characters
  cleanBody = cleanBody.replace(/&[a-zA-Z0-9#]+;/g, " ");
  cleanBody = cleanBody.replace(/\\[a-zA-Z0-9]+/g, " ");
  cleanBody = cleanBody.replace(/v\\\*/g, "");
  cleanBody = cleanBody.replace(/o\\\*/g, "");

  // Remove extra whitespace, newlines, and special characters
  cleanBody = cleanBody.replace(/\s+/g, " ").trim();

  // Remove any remaining curly braces and brackets
  cleanBody = cleanBody.replace(/[{}[\]]/g, " ");

  // Clean up any remaining special patterns
  cleanBody = cleanBody.replace(/[^\w\s.,!?;:()-]/g, " ");

  // Final cleanup - remove multiple spaces
  cleanBody = cleanBody.replace(/\s+/g, " ").trim();

  // If after cleaning there's no meaningful content, return empty
  if (cleanBody.length < 3 || /^[\s\W]*$/.test(cleanBody)) {
    return "";
  }

  // Truncate to maxLength and add ellipsis if needed
  if (cleanBody.length <= maxLength) {
    return cleanBody;
  }

  return cleanBody.substring(0, maxLength).trim() + "...";
};

// Test cases
console.log("Testing email body cleaning functions...\n");

// Test 1: Simple HTML email
const simpleHtml = `<html><body><p>Hello, this is a simple email.</p></body></html>`;
console.log("Test 1 - Simple HTML:");
console.log("Original:", simpleHtml);
console.log("Cleaned:", cleanEmailBody(simpleHtml));
console.log("Preview:", createBodyPreview(simpleHtml));
console.log("---");

// Test 2: Complex HTML with CSS and VML (similar to the problem emails)
const complexHtml = `
<html>
<head>
<style>
v\\:* {behavior:url(#default#VML);}
o\\:* {behavior:url(#default#VML);}
.EmailStyle17 {color:#1F4E79;}
</style>
</head>
<body>
<div style="font-family:Arial,sans-serif;">
<p>Dear Customer,</p>
<p>This is an important notification about your account.</p>
<v:rect style="width:100px;height:50px;">
<v:fill color="#ff0000"/>
</v:rect>
<o:p></o:p>
</div>
</body>
</html>
`;
console.log("Test 2 - Complex HTML with CSS and VML:");
console.log("Original length:", complexHtml.length);
console.log("Cleaned:", cleanEmailBody(complexHtml));
console.log("Preview:", createBodyPreview(complexHtml));
console.log("---");

// Test 3: HTML with embedded CSS and styling
const styledHtml = `
<html>
<body style="font-family:Arial,sans-serif;background-color:#f0f0f0;">
<div style="margin:20px;padding:10px;border:1px solid #ccc;">
<h2 style="color:#333;">Welcome to our service!</h2>
<p style="font-size:14px;line-height:1.4;">
We're excited to have you on board. Here are the next steps:
</p>
<ul style="margin-left:20px;">
<li>Complete your profile</li>
<li>Verify your email address</li>
<li>Start exploring our features</li>
</ul>
<p style="margin-top:20px;">
Best regards,<br>
The Team
</p>
</div>
</body>
</html>
`;
console.log("Test 3 - Styled HTML:");
console.log("Original length:", styledHtml.length);
console.log("Cleaned:", cleanEmailBody(styledHtml));
console.log("Preview:", createBodyPreview(styledHtml));
console.log("---");

// Test 4: Plain text (should pass through unchanged)
const plainText = "This is a plain text email without any HTML tags.";
console.log("Test 4 - Plain text:");
console.log("Original:", plainText);
console.log("Cleaned:", cleanEmailBody(plainText));
console.log("Preview:", createBodyPreview(plainText));
console.log("---");

console.log("Testing completed!");
