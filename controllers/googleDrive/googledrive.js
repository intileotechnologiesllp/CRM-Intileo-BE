const UserGoogleToken = require("../../models/googledrive/googledrive");

const { google } = require("googleapis");
const fs = require("fs");
const CLIENT_ID = process.env.CLIENT_ID; //"YOUR_CLIENT_ID";
const CLIENT_SECRET = process.env.CLIENT_SECRET; //"YOUR_CLIENT_SECRET";
const REDIRECT_URI = "http://localhost:3056/api/drive/callback";

exports.connectDrive = async (req, res) => {
  const {UserGoogleToken} = req.models;
  const authUrl = getAuthUrl();
  await UserGoogleToken.create({
    userId: req.adminId, // assume JWT auth
  });
  res.json({ url: authUrl });
};

exports.googleCallback = async (req, res) => {
  const userId = req.adminId; // assume JWT auth
  const { code } = req.query;
  const { UserGoogleToken } = req.models;

  const oauth2Client = await createOAuthClient(userId, UserGoogleToken);
  const { tokens } = await oauth2Client.getToken(code);
  await saveTokens(userId, tokens, UserGoogleToken);

  res.send("Google Drive Connected Successfully!");
};

exports.uploadFileToDrive = async (req, res) => {
  const { UserGoogleToken } = req.models;

  try {
    const userId = req.adminId; // Authenticated CRM user
    const oauth2Client = await createOAuthClient(userId, UserGoogleToken);
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const fileMetadata = { name: req.file.originalname };
    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(req.file.path),
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id, name, webViewLink, webContentLink",
    });

    // Remove file from local after upload (optional)
    fs.unlinkSync(req.file.path);

    console.log("UPLOAD RESPONSE", response.data);
    res.json({
      message: "File uploaded successfully!",
      file: response.data,
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).send("Upload failed!");
  }
};

exports.listDriveFiles = async (req, res) => {
  const { UserGoogleToken } = req.models;
  try {
    const userId = req.adminId; // Authenticated CRM user
    console.log("USER ID HERE", userId);
    const oauth2Client = await createOAuthClient(userId, UserGoogleToken);

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const { pageToken, folderId } = req.query;

    const query = folderId
      ? `'${folderId}' in parents and trashed=false`
      : "trashed=false";

    // const response = await drive.files.list({});
    const response = await drive.files.list({
      q: query,
      fields:
        "nextPageToken, files(id, name, mimeType, iconLink, webViewLink, createdTime, modifiedTime)",
      pageSize: 20,
      pageToken: pageToken?.toString(),
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    console.log("RESPONSE HERE", response);

    res.json({
      files: response.data.files,
      nextPageToken: response.data.nextPageToken || null,
    });
  } catch (error) {
    console.log("Drive File Fetch Error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.deletefile = async (req, res) => {
  const { UserGoogleToken } = req.models;
  try {
    const userId = req.adminId; // Authenticated CRM user
    const oauth2Client = await createOAuthClient(userId, UserGoogleToken);

    const drive = google.drive({ version: "v3", auth: oauth2Client });


    await drive.files.delete({
     fileId: req.params.id,
    });

    res.json({
      message: "file deleted successfully",
    });
  } catch (error) {
    console.log("Drive File Fetch Error:", error);
    res.status(500).json({ error: error.message });
  }
};

const createOAuthClient = async (userId, UserGoogleToken) => {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  if (!userId) return oauth2Client;

  const userToken = await UserGoogleToken.findOne({
    where:{
      userId: userId,
    }
  });
  if (userToken) {
    oauth2Client.setCredentials({
      access_token: userToken.accessToken,
      refresh_token: userToken.refreshToken,
      expiry_date: userToken.expiryDate?.getTime(),
    });
  }

  return oauth2Client;
};

const getAuthUrl = () => {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });
};

const saveTokens = async (userId, tokens, UserGoogleToken) => {
  await UserGoogleToken.upsert({
    userId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  });
};
