// Test the cleanEmailBody function with base64 images

// Mock the cleanEmailBody function to test
function mockCleanEmailBody(body, attachments = []) {
  const lines = body.split('\n');
  
  // Detect base64 images before processing
  const base64ImageMatches = body.match(/data:image\/[^;]+;base64,[^"'\s>]+/gi) || [];
  console.log(`[TEST] 🖼️ Base64 images found before cleaning: ${base64ImageMatches.length}`);
  base64ImageMatches.forEach((match, i) => {
    console.log(`[TEST] Image ${i + 1}: ${match.substring(0, 60)}...`);
  });

  // Create patterns to preserve base64 images
  const base64Patterns = base64ImageMatches.map(match => 
    match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );

  // Filter lines to preserve important content
  const preservedLines = lines.filter(line => {
    // Preserve lines with base64 images
    if (base64Patterns.some(pattern => line.includes(pattern))) {
      console.log(`[TEST] 🖼️ PRESERVING base64 image line: ${line.substring(0, 80)}...`);
      return true;
    }
    
    // Preserve other important content
    return line.trim().length > 0;
  });

  const cleanedBody = preservedLines.join('\n').trim();
  
  // Check if base64 images are still present after cleaning
  const finalBase64Images = cleanedBody.match(/data:image\/[^;]+;base64,[^"'\s>]+/gi) || [];
  console.log(`[TEST] ✅ Base64 images after cleaning: ${finalBase64Images.length} (${base64ImageMatches.length - finalBase64Images.length} lost)`);
  
  return cleanedBody;
}

// Test HTML content with base64 image
const testEmailBody = `<div dir="ltr">
<div>Hello there!</div>
<div><br></div>
<div>Please find the signature below:</div>
<div><br></div>
<div>
  <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=" alt="Signature">
</div>
<div>Best regards,</div>
<div>John Doe</div>
</div>`;

console.log('Testing cleanEmailBody with base64 embedded image...\n');
console.log('Original body length:', testEmailBody.length);
console.log('Original body preview:', testEmailBody.substring(0, 100) + '...\n');

const cleanedBody = mockCleanEmailBody(testEmailBody);

console.log('\nCleaned body length:', cleanedBody.length);
console.log('Cleaned body preview:', cleanedBody.substring(0, 100) + '...');

// Check if the base64 image is preserved
const hasBase64After = cleanedBody.includes('data:image/jpeg;base64');
console.log('\n🔍 RESULT: Base64 image preserved?', hasBase64After ? '✅ YES' : '❌ NO');