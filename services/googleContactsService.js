const { google } = require("googleapis");
const { OAuth2Client } = require("google-auth-library");

/**
 * Google Contacts Service
 * Handles all interactions with Google People API for contact sync
 */
class GoogleContactsService {
  constructor() {
    this.oauth2Client = null;
    this.people = null;
  }

  /**
   * Initialize OAuth2 client with credentials
   */
  initializeOAuth2Client(credentials) {
    const { googleAccessToken, googleRefreshToken } = credentials;

    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.oauth2Client.setCredentials({
      access_token: googleAccessToken,
      refresh_token: googleRefreshToken,
    });

    // Handle token refresh
    this.oauth2Client.on("tokens", (tokens) => {
      console.log("📱 [GOOGLE CONTACTS] Token refreshed automatically");
      if (tokens.refresh_token) {
        console.log("📱 [GOOGLE CONTACTS] New refresh token received");
      }
    });

    this.people = google.people({
      version: "v1",
      auth: this.oauth2Client,
    });

    return this.oauth2Client;
  }

  /**
   * Fetch all contacts from Google
   */
  async fetchAllContacts(pageSize = 1000) {
    try {
      console.log(`📱 [GOOGLE CONTACTS] Fetching all contacts...`);

      const allContacts = [];
      let pageToken = null;

      do {
        const response = await this.people.people.connections.list({
          resourceName: "people/me",
          pageSize: pageSize,
          pageToken: pageToken,
          personFields:
            "names,emailAddresses,phoneNumbers,addresses,organizations,birthdays,biographies,metadata",
        });

        const connections = response.data.connections || [];
        allContacts.push(...connections);

        pageToken = response.data.nextPageToken;
        console.log(
          `📱 [GOOGLE CONTACTS] Fetched ${connections.length} contacts (Total: ${allContacts.length})`
        );
      } while (pageToken);

      console.log(
        `✅ [GOOGLE CONTACTS] Successfully fetched ${allContacts.length} total contacts`
      );
      return allContacts;
    } catch (error) {
      console.error("❌ [GOOGLE CONTACTS] Error fetching contacts:", error);
      throw new Error(`Failed to fetch Google contacts: ${error.message}`);
    }
  }

  /**
   * Create a new contact in Google
   */
  async createContact(contactData) {
    try {
      console.log(
        `📱 [GOOGLE CONTACTS] Creating contact: ${contactData.name}`
      );

      const person = this.buildGooglePersonObject(contactData);

      const response = await this.people.people.createContact({
        requestBody: person,
      });

      console.log(
        `✅ [GOOGLE CONTACTS] Contact created: ${response.data.resourceName}`
      );
      return response.data;
    } catch (error) {
      console.error(
        `❌ [GOOGLE CONTACTS] Error creating contact:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Update an existing contact in Google
   */
  async updateContact(resourceName, contactData, etag) {
    try {
      console.log(
        `📱 [GOOGLE CONTACTS] Updating contact: ${resourceName}`
      );

      const person = this.buildGooglePersonObject(contactData);
      person.etag = etag; // Required for updates

      const response = await this.people.people.updateContact({
        resourceName: resourceName,
        updatePersonFields:
          "names,emailAddresses,phoneNumbers,addresses,organizations,birthdays,biographies",
        requestBody: person,
      });

      console.log(`✅ [GOOGLE CONTACTS] Contact updated: ${resourceName}`);
      return response.data;
    } catch (error) {
      console.error(
        `❌ [GOOGLE CONTACTS] Error updating contact:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Soft delete a contact in Google (unstar instead of delete)
   */
  async softDeleteContact(resourceName) {
    try {
      console.log(
        `📱 [GOOGLE CONTACTS] Soft deleting contact: ${resourceName}`
      );

      // Instead of deleting, we'll unstar/unmark the contact
      // This is safer as Google doesn't support proper soft deletes
      const response = await this.people.people.updateContact({
        resourceName: resourceName,
        updatePersonFields: "starred",
        requestBody: {
          starred: false,
        },
      });

      console.log(`✅ [GOOGLE CONTACTS] Contact soft deleted: ${resourceName}`);
      return response.data;
    } catch (error) {
      console.error(
        `❌ [GOOGLE CONTACTS] Error soft deleting contact:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Hard delete a contact in Google (permanent delete)
   */
  async deleteContact(resourceName) {
    try {
      console.log(
        `📱 [GOOGLE CONTACTS] Permanently deleting contact: ${resourceName}`
      );

      await this.people.people.deleteContact({
        resourceName: resourceName,
      });

      console.log(
        `✅ [GOOGLE CONTACTS] Contact permanently deleted: ${resourceName}`
      );
      return true;
    } catch (error) {
      console.error(
        `❌ [GOOGLE CONTACTS] Error deleting contact:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Normalize Google contact to CRM format
   */
  normalizeGoogleContact(googleContact) {
    try {
      const metadata = googleContact.metadata || {};
      const names = googleContact.names || [];
      const emails = googleContact.emailAddresses || [];
      const phones = googleContact.phoneNumbers || [];
      const addresses = googleContact.addresses || [];
      const organizations = googleContact.organizations || [];
      const biographies = googleContact.biographies || [];

      const primaryName = names.find((n) => n.metadata?.primary) || names[0];
      const primaryEmail =
        emails.find((e) => e.metadata?.primary) || emails[0];
      const primaryPhone =
        phones.find((p) => p.metadata?.primary) || phones[0];
      const primaryAddress =
        addresses.find((a) => a.metadata?.primary) || addresses[0];
      const primaryOrg = organizations.find((o) => o.metadata?.primary) || organizations[0];

      // Build emails array with all emails from Google contact
      const emailsArray = emails.map(emailObj => ({
        email: emailObj.value,
        type: emailObj.type || 'Work',
        isPrimary: emailObj.metadata?.primary || false
      }));

      // Build phones array with all phones from Google contact
      const phonesArray = phones.map(phoneObj => ({
        phone: phoneObj.value,
        type: phoneObj.type || 'Work',
        isPrimary: phoneObj.metadata?.primary || false
      }));

      return {
        googleContactId:
          metadata.sources?.[0]?.id || googleContact.resourceName,
        googleResourceName: googleContact.resourceName,
        googleEtag: googleContact.etag,
        contactPerson: primaryName?.displayName || "",
        firstName: primaryName?.givenName || "",
        lastName: primaryName?.familyName || "",
        email: primaryEmail?.value || "",
        phone: primaryPhone?.value || "",
        emails: emailsArray, // Array of all emails
        phones: phonesArray, // Array of all phones
        postalAddress: primaryAddress
          ? `${primaryAddress.streetAddress || ""}, ${
              primaryAddress.city || ""
            }, ${primaryAddress.region || ""} ${primaryAddress.postalCode || ""}, ${
              primaryAddress.country || ""
            }`.trim()
          : "",
        organization: primaryOrg?.name || "",
        jobTitle: primaryOrg?.title || "",
        notes: biographies.length > 0 ? biographies[0].value : "",
        googleUpdatedAt: metadata.sources?.[0]?.updateTime
          ? new Date(metadata.sources[0].updateTime)
          : new Date(),
        rawGoogleData: googleContact,
      };
    } catch (error) {
      console.error(
        `❌ [GOOGLE CONTACTS] Error normalizing contact:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Build Google Person object from CRM contact data
   */
  buildGooglePersonObject(contactData) {
    const person = {};

    // Names
    if (contactData.contactPerson || contactData.firstName || contactData.lastName) {
      person.names = [
        {
          displayName: contactData.contactPerson || 
            `${contactData.firstName || ""} ${contactData.lastName || ""}`.trim(),
          givenName: contactData.firstName || "",
          familyName: contactData.lastName || "",
          metadata: { primary: true },
        },
      ];
    }

    // Email addresses
    if (contactData.email) {
      person.emailAddresses = [
        {
          value: contactData.email,
          type: "work",
          metadata: { primary: true },
        },
      ];
    }

    // Phone numbers
    if (contactData.phone) {
      person.phoneNumbers = [
        {
          value: contactData.phone,
          type: "work",
          metadata: { primary: true },
        },
      ];
    }

    // Addresses
    if (contactData.postalAddress) {
      person.addresses = [
        {
          formattedValue: contactData.postalAddress,
          type: "work",
          metadata: { primary: true },
        },
      ];
    }

    // Organizations
    if (contactData.organization || contactData.jobTitle) {
      person.organizations = [
        {
          name: contactData.organization || "",
          title: contactData.jobTitle || "",
          type: "work",
          metadata: { primary: true },
        },
      ];
    }

    // Biographies (notes)
    if (contactData.notes) {
      person.biographies = [
        {
          value: contactData.notes,
          contentType: "TEXT_PLAIN",
          metadata: { primary: true },
        },
      ];
    }

    return person;
  }

  /**
   * Get authorization URL for OAuth
   */
  getAuthorizationUrl(masterUserID) {
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const scopes = [
      "https://www.googleapis.com/auth/contacts",
      "https://www.googleapis.com/auth/contacts.other.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent", // Force consent to get refresh token
      state: masterUserID.toString(), // Pass user ID to callback
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code) {
    try {
      const oauth2Client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      const { tokens } = await oauth2Client.getToken(code);
      
      // Get user info
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        email: userInfo.data.email,
      };
    } catch (error) {
      console.error("❌ [GOOGLE CONTACTS] Error getting tokens:", error);
      throw error;
    }
  }
}

module.exports = new GoogleContactsService();
