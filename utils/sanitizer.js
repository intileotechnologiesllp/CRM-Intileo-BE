/**
 * Input Sanitization Utility
 * Prevents XSS attacks and malicious input
 */

/**
 * Sanitize HTML to prevent XSS
 * @param {string} input - User input string
 * @returns {string} Sanitized string
 */
exports.sanitizeHtml = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove script tags and their content
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove on* event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove iframe, object, embed tags
  sanitized = sanitized.replace(/<(iframe|object|embed|link|style)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
  
  // Encode dangerous characters
  sanitized = sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  return sanitized;
};

/**
 * Sanitize form data object
 * @param {object} data - Form data object
 * @returns {object} Sanitized data object
 */
exports.sanitizeFormData = (data) => {
  if (typeof data !== 'object' || data === null) return data;
  
  const sanitized = {};
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const value = data[key];
      if (typeof value === 'string') {
        sanitized[key] = exports.sanitizeHtml(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = exports.sanitizeFormData(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
};

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
exports.isValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Validate phone format (international)
 * @param {string} phone
 * @returns {boolean}
 */
exports.isValidPhone = (phone) => {
  const phoneRegex = /^[\d\s\-\+\(\)]{7,20}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate URL format
 * @param {string} url
 * @returns {boolean}
 */
exports.isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Check for honeypot spam detection
 * @param {object} formData - Form submission data
 * @param {array} honeypotFields - Array of honeypot field names
 * @returns {boolean} True if spam detected
 */
exports.isSpamDetected = (formData, honeypotFields = ['company', 'website', 'phone_number']) => {
  // Check if any honeypot field is filled
  for (const field of honeypotFields) {
    if (formData[field] && formData[field].trim() !== '') {
      return true; // Spam detected
    }
  }
  return false;
};

/**
 * Rate limiting check using in-memory store
 * Simple implementation - for production use Redis
 */
const submissionStore = new Map();

exports.checkRateLimit = (identifier, limit = 5, windowMs = 900000) => {
  const now = Date.now();
  const key = `ratelimit:${identifier}`;
  
  if (!submissionStore.has(key)) {
    submissionStore.set(key, []);
  }
  
  const submissions = submissionStore.get(key);
  
  // Remove old submissions outside the time window
  const recentSubmissions = submissions.filter(time => now - time < windowMs);
  
  if (recentSubmissions.length >= limit) {
    return {
      allowed: false,
      retryAfter: Math.ceil((recentSubmissions[0] + windowMs - now) / 1000),
    };
  }
  
  // Add current submission
  recentSubmissions.push(now);
  submissionStore.set(key, recentSubmissions);
  
  return {
    allowed: true,
    remaining: limit - recentSubmissions.length,
  };
};

/**
 * Clean up old rate limit entries (call periodically)
 */
exports.cleanupRateLimits = () => {
  const now = Date.now();
  const windowMs = 900000; // 15 minutes
  
  for (const [key, submissions] of submissionStore.entries()) {
    const recentSubmissions = submissions.filter(time => now - time < windowMs);
    if (recentSubmissions.length === 0) {
      submissionStore.delete(key);
    } else {
      submissionStore.set(key, recentSubmissions);
    }
  }
};

// Clean up every 5 minutes
setInterval(exports.cleanupRateLimits, 300000);

module.exports = exports;
