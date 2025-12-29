/**
 * Web Form Embed Script Controller
 * Serves optimized, cacheable embed JavaScript
 */

const WebForm = require("../../models/webForm/webFormModel");
const WebFormField = require("../../models/webForm/webFormFieldModel");

/**
 * Serve embed script with form configuration
 * @route GET /api/public/webforms/embed/:uniqueKey.js
 */
exports.getEmbedScript = async (req, res) => {
  try {
    const { uniqueKey } = req.params;

    // Get form configuration
    const form = await WebForm.findOne({
      where: { uniqueKey, status: "active" },
      include: [
        {
          model: WebFormField,
          as: "fields",
          order: [["fieldOrder", "ASC"]],
        },
      ],
    });

    if (!form) {
      return res.status(404).type('application/javascript').send(
        `console.error('WebForm Error: Form not found or inactive');`
      );
    }

    // Parse field options
    const formData = form.toJSON();
    if (formData.fields) {
      formData.fields = formData.fields.map((field) => {
        if (field.options) {
          try {
            field.options = JSON.parse(field.options);
          } catch (e) {
            field.options = [];
          }
        }
        // Only include necessary field data
        return {
          fieldId: field.fieldId,
          fieldName: field.fieldName,
          fieldLabel: field.fieldLabel,
          fieldType: field.fieldType,
          placeholder: field.placeholder,
          isRequired: field.isRequired,
          validationPattern: field.validationPattern,
          errorMessage: field.errorMessage,
          options: field.options,
          fieldOrder: field.fieldOrder,
        };
      });
    }

    const API_BASE_URL = process.env.FRONTEND_URL || "http://213.136.77.55:4001";

    // Generate the embed script with configuration injected
    const embedScript = `
(function() {
  'use strict';
  
  // Injected Form Configuration
  var FORM_CONFIG = ${JSON.stringify({
    formKey: form.uniqueKey,
    formId: form.formId,
    formTitle: form.formTitle,
    formDescription: form.formDescription,
    primaryColor: form.primaryColor || '#3B82F6',
    buttonText: form.buttonText || 'Submit',
    successMessage: form.successMessage,
    redirectUrl: form.redirectUrl,
    gdprCompliant: form.gdprCompliant,
    consentText: form.consentText,
    privacyPolicyUrl: form.privacyPolicyUrl,
    fields: formData.fields,
    apiUrl: API_BASE_URL + '/api/public/webforms',
  }, null, 2)};

  // Prevent duplicate initialization
  if (window.WEBFORM_INITIALIZED && window.WEBFORM_INITIALIZED[FORM_CONFIG.formKey]) {
    console.warn('WebForm already initialized for key:', FORM_CONFIG.formKey);
    return;
  }
  window.WEBFORM_INITIALIZED = window.WEBFORM_INITIALIZED || {};
  window.WEBFORM_INITIALIZED[FORM_CONFIG.formKey] = true;

  // Session and tracking
  var sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  var visitorId = getVisitorId();
  var formStartTime = null;

  function getVisitorId() {
    try {
      var visitorId = localStorage.getItem('webform_visitor_id');
      if (!visitorId) {
        visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('webform_visitor_id', visitorId);
      }
      return visitorId;
    } catch (e) {
      return 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  }

  // Get UTM parameters
  function getUtmParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get('utm_source'),
      utmMedium: params.get('utm_medium'),
      utmCampaign: params.get('utm_campaign'),
      utmTerm: params.get('utm_term'),
      utmContent: params.get('utm_content')
    };
  }

  // Track events
  function trackEvent(eventType, eventData) {
    fetch(FORM_CONFIG.apiUrl + '/' + FORM_CONFIG.formKey + '/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: eventType,
        eventData: eventData,
        sessionId: sessionId,
        visitorId: visitorId,
        sourceUrl: window.location.href,
        referrerUrl: document.referrer,
        userAgent: navigator.userAgent
      })
    }).catch(function(err) {
      console.error('Tracking error:', err);
    });
  }

  // Render form
  function renderForm() {
    var container = document.getElementById('webform-' + FORM_CONFIG.formKey);
    if (!container) {
      console.error('WebForm container not found:', 'webform-' + FORM_CONFIG.formKey);
      return;
    }

    var html = '<div class="webform-wrapper" style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, \\'Segoe UI\\', Roboto, sans-serif;">';
    
    if (FORM_CONFIG.formTitle) {
      html += '<h2 style="color: #1f2937; margin-bottom: 8px;">' + escapeHtml(FORM_CONFIG.formTitle) + '</h2>';
    }
    
    if (FORM_CONFIG.formDescription) {
      html += '<p style="color: #6b7280; margin-bottom: 24px;">' + escapeHtml(FORM_CONFIG.formDescription) + '</p>';
    }

    html += '<form id="webform-form-' + FORM_CONFIG.formKey + '" style="display: flex; flex-direction: column; gap: 20px;">';

    // Honeypot fields (hidden spam trap)
    html += '<input type="text" name="company" style="position: absolute; left: -9999px; width: 1px; height: 1px;" tabindex="-1" autocomplete="off" aria-hidden="true" />';
    html += '<input type="text" name="website" style="position: absolute; left: -9999px; width: 1px; height: 1px;" tabindex="-1" autocomplete="off" aria-hidden="true" />';

    // Render form fields
    FORM_CONFIG.fields.forEach(function(field) {
      html += '<div class="webform-field">';
      html += '<label style="display: block; font-weight: 500; margin-bottom: 6px; color: #374151;">';
      html += escapeHtml(field.fieldLabel);
      if (field.isRequired) html += ' <span style="color: #ef4444;">*</span>';
      html += '</label>';

      var inputStyle = 'width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; transition: border-color 0.2s;';

      switch(field.fieldType) {
        case 'textarea':
          html += '<textarea name="' + field.fieldName + '" placeholder="' + escapeHtml(field.placeholder || '') + '" ';
          if (field.isRequired) html += 'required ';
          html += 'style="' + inputStyle + ' resize: vertical; min-height: 100px;"></textarea>';
          break;
        
        case 'select':
          html += '<select name="' + field.fieldName + '" ';
          if (field.isRequired) html += 'required ';
          html += 'style="' + inputStyle + '">';
          html += '<option value="">Select...</option>';
          (field.options || []).forEach(function(option) {
            html += '<option value="' + escapeHtml(option) + '">' + escapeHtml(option) + '</option>';
          });
          html += '</select>';
          break;
        
        case 'radio':
        case 'checkbox':
          (field.options || []).forEach(function(option) {
            html += '<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">';
            html += '<input type="' + field.fieldType + '" name="' + field.fieldName + '" value="' + escapeHtml(option) + '" ';
            if (field.isRequired) html += 'required ';
            html += '/>';
            html += '<span>' + escapeHtml(option) + '</span>';
            html += '</label>';
          });
          break;
        
        default:
          html += '<input type="' + field.fieldType + '" name="' + field.fieldName + '" ';
          html += 'placeholder="' + escapeHtml(field.placeholder || '') + '" ';
          if (field.isRequired) html += 'required ';
          if (field.validationPattern) html += 'pattern="' + escapeHtml(field.validationPattern) + '" ';
          html += 'style="' + inputStyle + '" />';
      }

      if (field.errorMessage) {
        html += '<small style="color: #ef4444; font-size: 12px; margin-top: 4px; display: none;" class="error-msg-' + field.fieldName + '">' + escapeHtml(field.errorMessage) + '</small>';
      }
      html += '</div>';
    });

    // GDPR consent
    if (FORM_CONFIG.gdprCompliant) {
      html += '<label style="display: flex; align-items: start; gap: 8px; font-size: 14px;">';
      html += '<input type="checkbox" name="gdpr_consent" required style="margin-top: 4px;" />';
      html += '<span>' + escapeHtml(FORM_CONFIG.consentText || 'I agree to the processing of my personal data');
      if (FORM_CONFIG.privacyPolicyUrl) {
        html += ' (<a href="' + escapeHtml(FORM_CONFIG.privacyPolicyUrl) + '" target="_blank" style="color: ' + FORM_CONFIG.primaryColor + ';">Privacy Policy</a>)';
      }
      html += '</span></label>';
    }

    // Submit button
    html += '<button type="submit" style="background: ' + FORM_CONFIG.primaryColor + '; color: white; padding: 12px 24px; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1">';
    html += escapeHtml(FORM_CONFIG.buttonText);
    html += '</button>';

    html += '<div id="webform-message-' + FORM_CONFIG.formKey + '" style="margin-top: 12px; padding: 12px; border-radius: 6px; display: none;"></div>';
    html += '</form></div>';

    container.innerHTML = html;

    // Attach event listeners
    var form = document.getElementById('webform-form-' + FORM_CONFIG.formKey);
    form.addEventListener('submit', handleSubmit);

    // Track form view
    trackEvent('view', { formId: FORM_CONFIG.formId });
    formStartTime = Date.now();
  }

  // Handle form submission
  function handleSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var formData = new FormData(form);
    var data = {};

    for (var pair of formData.entries()) {
      data[pair[0]] = pair[1];
    }

    // Check honeypot
    if (data.company || data.website) {
      console.warn('Spam detected via honeypot');
      showMessage('error', 'Submission failed. Please try again.');
      return;
    }

    // Remove honeypot fields from submission
    delete data.company;
    delete data.website;

    var submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    var utmParams = getUtmParams();
    var timeToSubmit = formStartTime ? Math.floor((Date.now() - formStartTime) / 1000) : null;

    fetch(FORM_CONFIG.apiUrl + '/' + FORM_CONFIG.formKey + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formData: data,
        sourceUrl: window.location.href,
        referrerUrl: document.referrer,
        utmSource: utmParams.utmSource,
        utmMedium: utmParams.utmMedium,
        utmCampaign: utmParams.utmCampaign,
        utmTerm: utmParams.utmTerm,
        utmContent: utmParams.utmContent,
        consentGiven: data.gdpr_consent === 'on',
        sessionId: sessionId,
        visitorId: visitorId,
        timeToSubmit: timeToSubmit
      })
    })
    .then(function(response) { return response.json(); })
    .then(function(result) {
      if (result.success) {
        showMessage('success', FORM_CONFIG.successMessage || 'Thank you! We will contact you soon.');
        form.reset();
        
        if (FORM_CONFIG.redirectUrl) {
          setTimeout(function() {
            window.location.href = FORM_CONFIG.redirectUrl;
          }, 2000);
        }
      } else {
        showMessage('error', result.message || 'Submission failed. Please try again.');
      }
    })
    .catch(function(error) {
      console.error('Submission error:', error);
      showMessage('error', 'Network error. Please check your connection and try again.');
    })
    .finally(function() {
      submitButton.disabled = false;
      submitButton.textContent = FORM_CONFIG.buttonText;
    });
  }

  // Show message
  function showMessage(type, message) {
    var msgEl = document.getElementById('webform-message-' + FORM_CONFIG.formKey);
    msgEl.style.display = 'block';
    msgEl.style.backgroundColor = type === 'success' ? '#d1fae5' : '#fee2e2';
    msgEl.style.color = type === 'success' ? '#065f46' : '#991b1b';
    msgEl.textContent = message;
  }

  // Escape HTML
  function escapeHtml(text) {
    var map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderForm);
  } else {
    renderForm();
  }
})();
`;

    // Set caching headers
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes cache
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    res.send(embedScript);
  } catch (error) {
    console.error("Error generating embed script:", error);
    res.status(500).type('application/javascript').send(
      `console.error('WebForm Error:', ${JSON.stringify(error.message)});`
    );
  }
};

module.exports = exports;
