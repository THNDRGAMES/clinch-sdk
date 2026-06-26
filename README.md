# THNDR SDK

## Overview
This project provides a reference implementation for integrating the THNDR SDK to show the web app in an iFrame. It includes a simple HTTP server setup, a reference HTML file (`index.html`), and the SDK JavaScript file (`thndr-sdk.js`). Follow the instructions below to get started.

## Installation and Running the HTTP Server

To serve your project locally, you will use the `http-server` package.

### Step-by-Step Installation

1. **Install Node.js**: Ensure you have Node.js installed on your system. You can download it from [Node.js](https://nodejs.org/).

2. **Install http-server**: Open your terminal and install the `http-server` package globally using npm:
   ```sh
   npm install -g http-server
   ```

3. **Navigate to Your Project Directory**: Change your terminal's current directory to your project's root directory (where the `thndr-sdk.js` file is located):
   ```sh
   cd /path/to/operator-sdk
   ```

4. **Run the HTTP Server**: Start the server with the following command:
   ```sh
   http-server -p 8005 -c-1 --cors
   ```
   - `-p 8005`: Specifies the port number to use.
   - `-c-1`: Disables caching.
   - `--cors`: Enables Cross-Origin Resource Sharing (CORS).

5. **Access the Example**: Open your web browser and navigate to:
   ```
   http://localhost:8005/examples/html/index.html
   ```

### Purpose of the JSON File for the Build Server
The `http-server.json` file configures the HTTP server. Here's a sample configuration from your project:
```json
{
  "headers": {
    "/**": {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    }
  }
}
```
This configuration ensures that the server does not cache any content, which is useful during development to always fetch the latest changes.

## Example implementation `index.html`

The `index.html` file serves as a reference implementation for integrating the THNDR SDK and web app. Here's a quick overview of its structure and how you can use it:

### Purpose of `index.html`
This file sets up an iframe and includes a script to load the THNDR SDK.

### How to Use
Read the latest documentation on https://docs.thndr.io/thndr

### Integration
To integrate this into your project, copy the content of `index.html` into your web application's HTML file where you want to include the THNDR iframe.

## Using `thndr-sdk.js`

The `thndr-sdk.js` file is the main SDK script that facilitates secure communication between your web application and the iFrame.

### Overview
This SDK handles token authentication requests, redirections, and ensures messages are only processed from the trusted THNDR Iframe.

### Example Usage
1. **Import and Initialize**: Include the SDK in your HTML file as shown in the `index.html` example.
2. **Implement getToken**: Provide the logic to fetch the token (see our API documentation), which will be used by the SDK to authenticate with THNDR.

### Cleaning up (teardown)

`initGame` registers a global `message` listener. In a single-page app where the
game can be mounted and unmounted (e.g. on route changes), you should remove that
listener when leaving the game so listeners don't accumulate and message handlers
don't fire multiple times.

There are two equivalent ways to tear down:

```js
import { initGame, destroyGame } from '/thndr-sdk.js';

// Option 1: use the `destroy` function returned by initGame
const destroy = await initGame("games_iframe", gameUrl, getToken, /* ... */);
// later, when the game is unmounted / the user navigates away:
destroy();

// Option 2: call destroyGame with the same iframe id
destroyGame("games_iframe");
```

Re-initializing the same iframe id is also safe: `initGame` automatically removes
the previous listener for that id before registering a new one, so a missed
teardown will not leak listeners across re-inits.

In frameworks, call teardown from the relevant lifecycle hook — e.g. React
`useEffect` cleanup, Angular `ngOnDestroy`, or Vue `onUnmounted`.

## FAQ

### What do I see an error popup in my iFrame saying "There was a problem logging in. Please try again later."
This means the AUTH_TOKEN was not valid. You should contact us so we can help you debug your authentication. Please see the authentication docs in our API.