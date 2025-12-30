const welcomeTemplate = (name) => {
  const html = `<body style="margin:0; padding:0; background-color:#f5f7fa; font-family: Arial, Helvetica, sans-serif;">
    
        <!-- Wrapper -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa; padding:30px 0;">
          <tr>
            <td align="center">
    
              <!-- Container -->
              <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:6px;">
    
                <!-- Header -->
                <tr>
                  <td align="center" style="padding:20px 20px 10px;">
                    <img src="https://www.pipedrive.com/favicon.ico" alt="Pipedrive" width="32" style="display:block;" />
                  </td>
                </tr>
    
                <!-- Info Icon -->
                <tr>
                  <td align="center" style="padding:10px 20px;">
                    <div style="width:44px; height:44px; background-color:#6f7bf7; border-radius:50%; color:#ffffff; font-size:22px; line-height:44px; text-align:center;">
                      i
                    </div>
                  </td>
                </tr>
    
                <!-- Content -->
                <tr>
                  <td style="padding:20px 40px; color:#333333; font-size:14px; line-height:1.6;">
                    <p>Hi <strong>${name}</strong>,</p>
    
                    <p>
                      We’re happy you’ve started your 14-day trial to experience Pipedrive,
                      the easy and effective CRM tool.
                    </p>
    
                    <p>
                      Over 100,000 companies use Pipedrive to grow their business and drive value.
                      You can, too — we want you to get the same great CRM experience and close more deals.
                    </p>
    
                    <p>
                      We’ve partnered with top certified solution provider partners to help you get
                      the most out of Pipedrive. These partners have years of experience and bring deep
                      CRM knowledge and sales methodology expertise.
                    </p>
    
                    <p><strong>They can help you by:</strong></p>
    
                    <ol style="padding-left:18px;">
                      <li>Demonstrating Pipedrive’s broad CRM capabilities</li>
                      <li>Defining and supporting CRM onboarding and configuration</li>
                      <li>Delivering enhanced one-to-one support</li>
                      <li>Providing guidance and advice on sales processes</li>
                    </ol>
    
                    <p>
                      <strong>Best of all, this initial consultation is 100% obligation- and cost-free!</strong>
                    </p>
    
                    <p><strong>What’s next?</strong></p>
    
                    <p>
                      We’ve shared your contact information (as per our
                      <a href="#" style="color:#2e7df6; text-decoration:none;">privacy policy</a>)
                      with one of our premier partners, who will contact you soon.
                    </p>
    
                    <p>
                      If you’d prefer not to take advantage of this offer, you can opt out at any time
                      by <a href="#" style="color:#2e7df6; text-decoration:none;">clicking here</a>.
                    </p>
    
                    <p>
                      Happy closing,<br/>
                      <strong>Your friends at Pipedrive</strong>
                    </p>
                  </td>
                </tr>
    
                <!-- Social Icons -->
                <tr>
                  <td align="center" style="padding:10px 20px;">
                    <a href="#"><img src="https://cdn-icons-png.flaticon.com/24/733/733547.png" width="20" style="margin:0 5px;" /></a>
                    <a href="#"><img src="https://cdn-icons-png.flaticon.com/24/733/733579.png" width="20" style="margin:0 5px;" /></a>
                    <a href="#"><img src="https://cdn-icons-png.flaticon.com/24/2111/2111463.png" width="20" style="margin:0 5px;" /></a>
                    <a href="#"><img src="https://cdn-icons-png.flaticon.com/24/174/174857.png" width="20" style="margin:0 5px;" /></a>
                    <a href="#"><img src="https://cdn-icons-png.flaticon.com/24/1384/1384060.png" width="20" style="margin:0 5px;" /></a>
                  </td>
                </tr>
    
                <!-- Footer -->
                <tr>
                  <td align="center" style="padding:20px; font-size:11px; color:#888888;">
                    <strong style="color:#28a745;">pipedrive</strong><br/><br/>
                    © 2025 Pipedrive Inc. All rights reserved.<br/>
                    530 Fifth Avenue, Suite 802 · New York, NY 10036, USA<br/><br/>
                    Need assistance? Email us at
                    <a href="mailto:support@pipedrive.com" style="color:#2e7df6; text-decoration:none;">
                      support@pipedrive.com
                    </a>
                  </td>
                </tr>
    
              </table>
              <!-- End Container -->
    
            </td>
          </tr>
        </table>
    
      </body>`;
  return html;
};

module.exports = welcomeTemplate;
