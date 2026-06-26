/**
 * THNDR Operator SDK
 *
 * This SDK facilitates secure messaging between the operator's website and a THNDR iframe. 
 * It handles token authentication, balance checks, and invoice payments via postMessage communication.
 * The SDK also includes a debug mode for logging key events during the integration process.
 */

/**
 * @constant {Object} MessageTypes
 * Defines the different types of messages that can be sent between the operator and the THNDR iframe.
 */
const MessageTypes = Object.freeze({
  GET_SDK_VERSION: "operator_get_sdk_version", // Get the version of the SDK
  SET_SDK_VERSION: "operator_set_sdk_version", // Set the version of the SDK
  GET_TOKEN: "operator_get_token", // Request token from the operator
  SET_TOKEN: "operator_set_token", // Send token to the iframe
  GET_BALANCE: "operator_get_balance", // Request balance from the operator
  SET_BALANCE: "operator_set_balance", // Send the balance to the iframe
  DEMO_BALANCE_UPDATE: "operator_demo_balance_update", // Update the balance for demo purposes
  PAY_INVOICE: "operator_pay_invoice", // Pay an invoice
  CANCEL_INVOICE: "operator_cancel_invoice", // Cancel an invoice
  REDIRECT: "operator_redirect", // Redirect the user to a new page
  CLOSE: "operator_close", // Close the iframe
  HANDLE_PAYMENT_ERROR: "operator_handle_payment_error", // Handle payment errors
  PAYMENT_ERROR_HANDLED: "operator_payment_error_handled", // Error handled
  ANALYTICS_EVENT: "operator_analytics_event", // Analytics event from the iframe
});

var SDK_VERSION = "2.0.6";
export var demoBalance = 20000; // 200.00 USD
export var loggingEnabled = false; // Enable logging for debugging

/**
 * Tracks the active `message` listener registered per iframe so that
 * re-initializing the same game (e.g. on SPA navigation) does not stack up
 * duplicate global listeners. Keyed by the iframe id passed to `initGame`.
 *
 * @type {Map<string, EventListener>}
 */
const activeListeners = new Map();

/**
 * Tells the THNDR iframe that this invoice is not going to be paid and to disregard.
 */
export function cancelInvoice(invoice, origin) {
  postMessage({
    message: MessageTypes.CANCEL_INVOICE,
    invoice,
  }, origin);
}

export function enableLogging() {
  loggingEnabled = true;
}

/**
 * Removes the `message` listener registered by `initGame` for a given iframe.
 * Use this to clean up when a game is unmounted or the user navigates away,
 * preventing listener accumulation and duplicate message handling. This is an
 * alternative to the `destroy` function returned by `initGame`.
 *
 * @function destroyGame
 * @param {string} iframeId - The id of the iframe passed to `initGame`.
 */
export function destroyGame(iframeId) {
  const listenerKey = iframeId || 'frame';
  const handler = activeListeners.get(listenerKey);
  if (handler) {
    window.removeEventListener("message", handler);
    activeListeners.delete(listenerKey);
  }
}

/**
 * Initializes the THNDR SDK by listening for postMessage events from the iframe and responding accordingly.
 *
 * @async
 * @function initGame
 * @param {string} iframeId - The id of the iframe.
 * @param {string} iframeUrl - The url of the iframe.
 * @param {Function} getToken - Callback to retrieve the authentication token.
 * @param {Function} getBalance - Callback to retrieve the user's balance.
 * @param {Function} closeIframe - Callback to close the iframe.
 * @param {Function} handlePaymentError - Callback to handle a payment error.
 * @param {Function} [analyticsEvent] - Callback to handle analytics events.
 * @param {Function} [onPayInvoice] - Optional callback to process invoice payments.
 * @returns {Promise<Function>} Resolves to a `destroy` function that removes the
 *   `message` listener registered for this iframe. Call it when the game is
 *   unmounted or the user navigates away to avoid leaking listeners. Re-calling
 *   `initGame` for the same iframe id is also safe: the previous listener is
 *   removed automatically before the new one is registered.
 */
export async function initGame(
  iframeId,
  iframeUrl,
  getToken,
  getBalance,
  closeIframe,
  handlePaymentError,
  analyticsEvent,
  onPayInvoice = null
) {
  const origin = iframeUrl;
  const elementId = iframeId ? `#${iframeId}` : 'frame';
  // Key used to track this game's listener in `activeListeners`. Falls back to a
  // stable value when no id is supplied so repeated init/destroy stays consistent.
  const listenerKey = iframeId || 'frame';

  await waitForElm(elementId);

  /**
   * Logs debug messages to the console when debug mode is enabled.
   *
   * @param {string} message - The debug message to be logged.
   */
  function logDebug(message) {
    if (loggingEnabled) {
      console.log(`THNDR SDK (v${SDK_VERSION}): ${message}`);
    }
  }

  /**
   * Event listener for incoming postMessage events from the THNDR iframe.
   * Handles messages based on their type (e.g., token requests, balance requests, etc.).
   * Named (not anonymous) so it can be removed via `removeEventListener`.
   */
  async function messageHandler(event) {
    // Validate the origin of the message
    if (!isMessageFromTHNDR(event, origin)) {
      return;
    }

    logDebug(`Received message from origin ${event.origin}`);

    // Parse the incoming message
    let messageData;
    try {
      messageData = JSON.parse(event.data);
      logDebug(`Message: ${JSON.stringify(messageData.message)}`);
    } catch (e) {
      console.error("THNDR SDK: Failed to parse message data", e);
      return;
    }

    // Handle the message based on its type
    try {
      await handleMessage(messageData.message, messageData, origin, elementId, getToken, getBalance, closeIframe, analyticsEvent, onPayInvoice);
    } catch (e) {
      console.error("THNDR SDK: Error handling message", e);
    }
  }

  // Remove any listener previously registered for this iframe so re-initializing
  // the same game does not stack up duplicate global listeners.
  if (activeListeners.has(listenerKey)) {
    window.removeEventListener("message", activeListeners.get(listenerKey));
  }
  window.addEventListener("message", messageHandler);
  activeListeners.set(listenerKey, messageHandler);

  /**
   * Handles specific message types by executing the appropriate callback or action.
   *
   * @async
   * @function handleMessage
   * @param {string} message - The message type (e.g., GET_TOKEN).
   * @param {Object} messageData - The full message object received from the iframe.
   * @param {string} origin - The origin of the message (for validation).
   * @param {string} iframeId - The iframe id
   * @param {Function} getToken - Callback to retrieve the authentication token.
   * @param {Function} getBalance - Callback to retrieve the user's balance.
   * @param {Function} analyticsEvent - Callback to handle analytics events.
   * @param {Function} onPayInvoice - Callback to process invoice payments.
   */
  async function handleMessage(message, messageData, origin, iframeId, getToken, getBalance, closeIframe, analyticsEvent, onPayInvoice) {
    logDebug(`Handling message: ${message}`);
    switch (message) {
      case MessageTypes.GET_SDK_VERSION:
        logDebug("Sent SDK version in response to GET_SDK_VERSION");
        postMessage({
          message: MessageTypes.SET_SDK_VERSION,
          version: SDK_VERSION,
        }, origin, iframeId);
        break;
      case MessageTypes.GET_TOKEN:
        logDebug("Sent token in response to GET_TOKEN");
        postMessage({
          message: MessageTypes.SET_TOKEN,
          token: await Promise.resolve(getToken()),
        }, origin, iframeId);
        break;
      case MessageTypes.PAY_INVOICE:
        if (onPayInvoice) {
          logDebug(`Invoice received: ${JSON.stringify(messageData.data.invoice)}`);
          onPayInvoice(messageData.data.invoice);
        }
        break;
      case MessageTypes.GET_BALANCE:
        logDebug("Sent balance in response to GET_BALANCE");
        const balance = await Promise.resolve(getBalance());
        postMessage({
          message: MessageTypes.SET_BALANCE,
          balance: balance.balance,
          currency: balance.currency,
        }, origin, iframeId);
        break;
      case MessageTypes.REDIRECT:
      case MessageTypes.CLOSE:
        closeIframe(messageData.data.name);
        break;
      case MessageTypes.DEMO_BALANCE_UPDATE:
        demoBalance += messageData.data.balanceInc;
        break;
      case MessageTypes.HANDLE_PAYMENT_ERROR:
        logDebug("Error received from iframe HANDLE_PAYMENT_ERROR");
        const errorAction = await Promise.resolve(handlePaymentError(messageData.data.error));
        // Expected {  action: "RETRY" | "GENERIC_ERROR" | "OPERATOR_ERROR" | "IGNORE"}
        const validActions = ["RETRY", "GENERIC_ERROR", "OPERATOR_ERROR", "IGNORE"];
        if (errorAction?.action && validActions.includes(errorAction.action)) {
          postMessage({
            message: MessageTypes.PAYMENT_ERROR_HANDLED,
            data: errorAction,
          }, origin, iframeId);
        } else {
          console.error(`THNDR SDK (v${SDK_VERSION}): Invalid handlePaymentError response received: ${errorAction}. Expected: { action: "${validActions.join('" | "')}" }`);
        }
        break;
      case MessageTypes.ANALYTICS_EVENT:
        logDebug(`Analytics event received: ${messageData.data.eventName}`);
        analyticsEvent(messageData.data.eventName);
        break;
      default:
        logDebug(`Unknown message type received: ${message}`);
    }
  }

  /**
   * Tears down this game's `message` listener. Safe to call multiple times.
   */
  return function destroy() {
    window.removeEventListener("message", messageHandler);
    // Only clear the registry entry if it still points at this handler, so a
    // teardown invoked after a re-init does not remove the newer listener.
    if (activeListeners.get(listenerKey) === messageHandler) {
      activeListeners.delete(listenerKey);
    }
  };
}

/**
 * Validates if a message originates from the expected THNDR iframe.
 *
 * @function isMessageFromTHNDR
 * @param {Object} event - The postMessage event received from the iframe.
 * @param {string} origin - The expected origin of the iframe (for security validation).
 * @returns {boolean} - Returns true if the message is valid, false otherwise.
 */
function isMessageFromTHNDR(event, origin) {
  if (event.origin !== origin) {
    return false;
  }
  try {
    const data = JSON.parse(event.data);
    return Object.values(MessageTypes).includes(data.message);
  } catch (e) {
    return false;
  }
}

/**
 * Sends a message to the THNDR iframe via postMessage.
 *
 * @function postMessage
 * @param {Object} messageObject - The message object to send to the iframe.
 * @param {string} origin - The origin of the iframe (for security validation).
 */
export function postMessage(messageObject, origin, iframeId) {
  const messageJSON = JSON.stringify(messageObject);
  const iframe = document.querySelector(iframeId);
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage(messageJSON, origin);
  } else {
    console.error("THNDR SDK: Unable to find the iframe");
  }
}

function waitForElm(selector) {
  return new Promise(resolve => {
      if (document.querySelector(selector)) {
          return resolve(document.querySelector(selector));
      }

      const observer = new MutationObserver(mutations => {
          if (document.querySelector(selector)) {
              observer.disconnect();
              resolve(document.querySelector(selector));
          }
      });

      observer.observe(document.body, {
          childList: true,
          subtree: true
      });
  });
}