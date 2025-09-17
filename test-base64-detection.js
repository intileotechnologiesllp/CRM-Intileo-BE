// Test base64 image detection and preservation in cleanEmailBody function

// Mock function to test base64 image detection
function testBase64Detection() {
  console.log('Testing base64 image detection patterns...\n');
  
  // Test HTML with base64 embedded image
  const htmlWithBase64 = `
    <div>
      <p>Hello, here is an embedded image:</p>
      <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=">
      <p>And some more text</p>
    </div>
  `;

  // Test base64 regex patterns
  const patterns = [
    /data:image\/[^;]+;base64,[^"'\s>]+/gi,
    /src="data:image\//gi,
    /base64,/gi
  ];

  patterns.forEach((pattern, index) => {
    const matches = htmlWithBase64.match(pattern);
    console.log(`Pattern ${index + 1}: ${pattern}`);
    console.log(`Matches: ${matches ? matches.length : 0}`);
    if (matches) {
      console.log('Found:', matches);
    }
    console.log('---');
  });

  // Test the specific pattern used in cleanEmailBody
  const base64ImageMatches = htmlWithBase64.match(/data:image\/[^;]+;base64,[^"'\s>]+/gi) || [];
  console.log(`\nBase64 images detected: ${base64ImageMatches.length}`);
  base64ImageMatches.forEach((match, i) => {
    console.log(`Image ${i + 1}: ${match.substring(0, 50)}...`);
  });
}

testBase64Detection();