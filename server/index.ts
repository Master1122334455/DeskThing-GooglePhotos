import { DeskThing as DK, AppSettings } from 'deskthing-server';
import * as fs from 'fs/promises';
import * as path from 'path';
import express from 'express';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import * as os from 'os'; // Import os to get the temp directory
import * as crypto from 'crypto'; // Import crypto for unique file names

const DeskThing = DK.getInstance();
export { DeskThing };

const SCOPES = ['https://www.googleapis.com/auth/photospicker.mediaitems.readonly'];

const app = express();
const PORT = 8899;

let accessToken: string | null = null;
const tempFolder = path.join(os.tmpdir(), 'deskthing-images'); // Temporary folder for images
let downloadedImages: string[] = []; // Array to store downloaded image paths
let currentImageIndex = 0; // Index to track the current image to send
let Data: any; // Declare Data at a higher scope
let isSendingImages = false; // Flag to track if the image sending loop is active

// Ensure the temp folder exists
fs.mkdir(tempFolder, { recursive: true }).catch(console.error);

// Function to initialize data and prompt for Google API credentials
async function initializeData() {
  const data = await DeskThing.getData();
  if (data) {
    Data = data;
  }

  if (!Data.client_id || !Data.client_secret) {
    const requestScopes = {
      'client_id': {
        'value': '',
        'label': 'Google Client ID',
        'instructions': 'You can get your Google Client ID from the <a href="https://console.developers.google.com/apis/credentials" target="_blank" style="color: lightblue;">Google Developer Console</a>. Create a new project and then create credentials.',
      },
      'client_secret': {
        'value': '',
        'label': 'Google Client Secret',
        'instructions': 'You can get your Google Client Secret from the <a href="https://console.developers.google.com/apis/credentials" target="_blank" style="color: lightblue;">Google Developer Console</a>. Create a new project and then create credentials.',
      },
      'redirect_uri': {
        'value': 'http://localhost:8899/oauth2callback',
        'label': 'Redirect URL',
        'instructions': 'Set the Google Redirect URI to http://localhost:8899/oauth2callback and then click "Save". This ensures you can authenticate your account to this application.',
      }
    };

    DeskThing.getUserInput(requestScopes, (inputData) => {
      if (inputData.payload.client_id && inputData.payload.client_secret) {
        DeskThing.saveData(inputData.payload);
        Data = inputData.payload;
        setupOAuthClient();
        sendAuthLinkToConsole(); // Call this after user input
      } else {
        DeskThing.sendError('Please fill out all the fields! Restart the application to try again.');
      }
    });
  } else {
    DeskThing.sendLog('Data Found!');
    setupOAuthClient();
  }
}

const setupOAuthClient = () => {
  const oauth2Client = new OAuth2Client(Data.client_id, Data.client_secret, Data.redirect_uri);
  return oauth2Client;
};

// Route to initiate OAuth 2.0 flow
app.get('/auth', (req, res) => {
  try {
    const oauth2Client = setupOAuthClient();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    DeskThing.sendError(authUrl);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).send('Error generating auth URL');
  }
});

// OAuth2 callback route
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code as string;
  try {
    const oauth2Client = setupOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    accessToken = tokens.access_token || null;
    res.send('Authentication successful! You can close this window.');

    if (accessToken) {
      await handleImageSourcePrompt();
    }
  } catch (error) {
    console.error('Error during OAuth callback:', error);
    res.status(500).send('Error during OAuth callback');
  }
});

app.listen(PORT, () => {
  console.log(`OAuth2 server listening at http://localhost:${PORT}`);
});

// Function to send the authentication link to the console
const sendAuthLinkToConsole = () => {
  try {
    const oauth2Client = setupOAuthClient();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    DeskThing.sendError(`Please authenticate here: ${authUrl}`);  // Send the auth URL to DeskThing console
  } catch (error) {
    DeskThing.sendError(`Error generating auth URL: ${error}`);
  }
};

// Function to handle image source prompt
const handleImageSourcePrompt = async () => {
  const sessionId = await createPickerSession();
  if (sessionId) {
    const selectionComplete = await pollSession(sessionId);
    if (selectionComplete) {
      const mediaItems = await listPickedMediaItems(sessionId);
      if (mediaItems.length > 0) {
        await clearTempFolder(); // Clear the temp folder before downloading new images
        await downloadImages(mediaItems); // Download all selected images
        currentImageIndex = 0;
      } else {
        DeskThing.sendError('No media items selected.');
      }
    }
  }
};

// Function to clear the temp folder
const clearTempFolder = async () => {
  try {
    await fs.rm(tempFolder, { recursive: true, force: true });
    await fs.mkdir(tempFolder, { recursive: true }); // Recreate the temp folder
  } catch (error) {
    DeskThing.sendError(`Error clearing temp folder: ${error.message}`);
  }
};

// Function to download images
const downloadImages = async (mediaItems) => {
  downloadedImages = []; // Clear previous images
  for (const mediaItem of mediaItems) {
    const imageUrl = getImageUrl(mediaItem.mediaFile);
    if (imageUrl) {
      const filePath = path.join(tempFolder, `${crypto.randomBytes(16).toString('hex')}.jpg`); // Unique file name
      try {
        const response = await axios.get(imageUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          responseType: 'arraybuffer',
        });
        await fs.writeFile(filePath, response.data); // Save image to temp folder
        downloadedImages.push(filePath); // Add to the array of downloaded images
      } catch (error) {
        DeskThing.sendError(`Error downloading image: ${error.message}`);
      }
    }
  }
};

// Function to send the next image to the client with a delay
const sendNextImageToClient = async () => {
  // Check if the loop is already running
  if (isSendingImages) {
    return; // Exit if the loop is already running
  }

  isSendingImages = true; // Set the flag to indicate the loop is running

  const files = await fs.readdir(tempFolder); 

  // If there are no images available to send
  if (downloadedImages.length === 0 && files.length === 0) {
    DeskThing.sendError('No images available to send.');
    isSendingImages = false; // Reset the flag
    return;
  }

  // If downloadedImages is empty, populate it with files from the temp folder
  if (downloadedImages.length === 0) {
    downloadedImages = files.map(file => path.join(tempFolder, file));
  }

  // If there are still no images available, send an error
  if (downloadedImages.length === 0) {
    DeskThing.sendError('No images available to send.');
    isSendingImages = false; // Reset the flag
    return;
  }

  const imagePath = downloadedImages[currentImageIndex];
  try {
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = 'image/jpeg'; // Assuming JPEG format

    DeskThing.sendDataToClient({
      type: 'imageData',
      payload: `data:image/${mimeType};base64,${base64Image}`,
    });

    currentImageIndex = (currentImageIndex + 1) % downloadedImages.length; // Rotate to the next image

    // Get the rotation interval from settings
    const rotationInterval = Data?.settings?.rotation_interval?.value || 15; // Default to 15 seconds if not set

    // Wait for the specified interval before sending the next image
    setTimeout(() => {
      isSendingImages = false;
      sendNextImageToClient(); // Call the function again after the delay
    }, rotationInterval * 1000); // Convert seconds to milliseconds
  } catch (error) {
    DeskThing.sendError(`Error reading image file: ${error.message}`);
  }
};

// Function to create a picker session
const createPickerSession = async () => {
  if (!accessToken) {
    DeskThing.sendError('Access token is not available. Please authenticate first.');
    return null;
  }
  try {
    const response = await fetch('https://photospicker.googleapis.com/v1/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    const { pickerUri, id: sessionId } = data;
    DeskThing.sendLog('Picker session created. Please visit: ' + pickerUri);
    return sessionId;
  } catch (error) {
    DeskThing.sendError('Error creating picker session: ' + error);
    return null;
  }
};

// Function to poll the session
const pollSession = async (sessionId: string) => {
  if (!accessToken) {
    DeskThing.sendError('Access token is not available. Please authenticate first.');
    return false;
  }
  try {
    let mediaItemsSet = false;
    while (!mediaItemsSet) {
      const response = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();
      mediaItemsSet = data.mediaItemsSet;
      if (!mediaItemsSet) {
        const pollInterval = data.pollingConfig.pollInterval || 5000;
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }
    return true;
  } catch (error) {
    DeskThing.sendError('Error polling session: ' + error);
    return false;
  }
};

// Function to list picked media items
const listPickedMediaItems = async (sessionId: string) => {
  if (!accessToken) {
    DeskThing.sendError('Access token is not available. Please authenticate first.');
    return [];
  }
  try {
    const response = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}&pageSize=25`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const data = await response.json();
    return data.mediaItems;
  } catch (error) {
    DeskThing.sendError('Error listing media items: ' + error);
    return [];
  }
};

// Function to get image URL
const getImageUrl = (mediaFile: any) => {
  if (!mediaFile.baseUrl) {
    DeskThing.sendError('Base URL for media file is undefined.');
    return null;
  }

  const width = mediaFile.mediaFileMetadata?.width;
  const height = mediaFile.mediaFileMetadata?.height;

  if (width && height) {
    return `${mediaFile.baseUrl}=w${width}-h${height}`;
  } else {
    DeskThing.sendError('Width or height is undefined in media file metadata.');
    return null;
  }
};

// Start function
const start = async () => {
  await initializeData(); // Call the new initializeData function
  DeskThing.on('data', (newData) => {
    Data = newData;
  });
  const settings: AppSettings = {
    rotation_interval: {
      label: "Seconds",
      value: 30,
      description: 'The interval you want to rotate the image in seconds.',
      type: 'number',
      min: 15,
      max: 1800,
    },
  };
  DeskThing.addSettings(settings);

  DeskThing.on('get', async (data) => {
    if (data.type == null) {
      DeskThing.sendError('No args provided!');
      return;
    }
    switch (data.request) {
      case 'image':
        try {
          const files = await fs.readdir(tempFolder); // Read the contents of the temp folder
          if (files.length > 0) {
            await sendNextImageToClient(); // Trigger sending the next image if there are images
          } else {
            DeskThing.sendError('No images found in the temp folder.');
          }
        } catch (error) {
          DeskThing.sendError(`Error reading temp folder: ${error.message}`);
        }
        break;
      default:
        DeskThing.sendError(`Unknown request: ${data.request}`);
        break;
    }
  });

};

// Stop function
const stop = async () => {
  // Clean up temporary images if needed
  await fs.rm(tempFolder, { recursive: true, force: true }).catch(console.error);
};

// Main Entrypoint of the server
DeskThing.on('start', start);

// Main exit point of the server
DeskThing.on('stop', stop);