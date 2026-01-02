/**
 * Embed Code Generator for Web Forms
 * Generates optimized external script embed code (Zoho/HubSpot style)
 */

const API_BASE_URL = process.env.FRONTEND_URL || "http://213.136.77.55:4001";

/**
 * Generate embed code for a form (Modern External Script Approach)
 * @param {object} form - WebForm instance
 * @returns {string} Minimal HTML embed code with external JS
 */
exports.generateEmbedCode = (form) => {
  const embedCode = `<!-- ${form.formName} - Embed Code -->
<!-- Paste this code where you want the form to appear -->

<div id="webform-${form.uniqueKey}"></div>
<script 
  src="${API_BASE_URL}/api/public/webforms/embed/${form.uniqueKey}.js"
  data-form-key="${form.uniqueKey}"
  async
></script>

<!-- 
  🔒 Features included:
  ✓ Spam protection (honeypot + rate limiting)
  ✓ XSS sanitization
  ✓ UTM tracking
  ✓ GDPR compliance
  ✓ Real-time validation
-->`;

  return embedCode;
};

/**
 * Generate iframe embed code (alternative method)
 * @param {object} form - WebForm instance
 * @returns {string} Iframe embed code
 */
exports.generateIframeCode = (form) => {
  const iframeUrl = `${API_BASE_URL}/embed/form/${form.uniqueKey}`;
  
  return `<iframe src="${iframeUrl}" width="100%" height="600" frameborder="0" style="border: 1px solid #e5e7eb; border-radius: 8px;"></iframe>`;
};

/**
 * Generate React component embed code
 * @param {object} form - WebForm instance
 * @returns {string} React component code
 */
exports.generateReactComponent = (form) => {
  return `import React, { useEffect } from 'react';

const WebForm_${form.uniqueKey.replace(/-/g, '_')} = () => {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '${API_BASE_URL}/api/public/webforms/embed/${form.uniqueKey}.js';
    script.async = true;
    script.setAttribute('data-form-key', '${form.uniqueKey}');
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return <div id="webform-${form.uniqueKey}"></div>;
};

export default WebForm_${form.uniqueKey.replace(/-/g, '_')};`;
};

module.exports = exports;
