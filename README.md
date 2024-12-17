
# Google Photos

Video Tutorial: https://youtu.be/wMS0fOaFTtg

To download the DeskThing Google Photos app download the .zip file at https://github.com/Master1122334455/DeskThing-GooglePhotos/releases/tag/Release

To upload the app in DeskThing, naviagate to the DeskThing application then go to Downloads and Upload App. Select the .zip file you just downloaded.

Once uploaded the application will require Google Cloud API credentials.


To generate client ID and client secret
This section explains how to generate a client ID and client secret on Google Developers Console. https://console.cloud.google.com/apis/api/photospicker.googleapis.com

First, go to the Google Developers Console to enable Google Photo Picker API .

Select Create project, enter a project name and select Create.

Enable the Google Photo Picker API.

Navigate to APIs & Services (left sidebar) > Credentials.

In the left sidebar, select OAuth consent screen.

Select External and Create.

Set the App name (the name of the application asking for consent) to anything you want, e.g., DeskThing Google Photos.

You then need to select a Support email.

From the dropdown menu, select your email address.

Under Developer contact information, enter your email address (the same as above is fine).

Scroll to the bottom and select Save and continue.

You don’t have to fill out anything else here. Adding other information to this page (like an app logo) may trigger an additional review process from Google and delay setup by days.

You will then be automatically taken to the Scopes page.

Select Add Scopes and find the Google Photo Picker API. Select the API and click save.

Add your email address once again under the Test users. Select Save and continue, which will take you to the Summary page.

Select Back to dashboard.

Select OAuth consent screen again and under Publishing status, select Publish app.

Otherwise your credentials will expire every 7 days.

Make sure Publishing status is set to In production.

In the left sidebar, select Credentials, then select Create credentials (at the top of the screen), then select OAuth client ID.

Set the Application type to Web application and give this credential set a name (like “DeskThing Photos Credentials”).

Add http://localhost:8899/oauth2callback to Authorized redirect URIs then select Create.

This is not a placeholder. It is the URI that must be used.

You will then be presented with a pop-up saying OAuth client created, showing Your client ID and Your client secret.

Make a note of these (for example, copy and paste them into a text editor), as you will need them shortly.

Once you have noted these strings, select OK and open the DeskThing Application.

Enter the newly created Client ID and Client Secret into the Google Photos App request.

Once authenticated you'll be able to sign in and select photos to upload the the Car Thing.

