/**
 * Clinch Operator SDK
 *
 * This SDK facilitates secure messaging between the operator's website and a Clinch iframe. 
 * It handles token authentication, balance checks, and invoice payments via postMessage communication.
 * The SDK also includes a debug mode for logging key events during the integration process.
 */

/**
 * @constant {Object} MessageTypes
 * Defines the different types of messages that can be sent between the operator and the Clinch iframe.
 */
const MessageTypes = Object.freeze({
  GET_CONFIG: "operator_get_config", // Request the configuration from the operator
  SET_CONFIG: "operator_set_config", // Set the configuration for the Clinch SDK
  GET_TOKEN: "operator_get_token", // Request token from the operator
  SET_TOKEN: "operator_set_token", // Send token to the iframe
  GET_BALANCE: "operator_get_balance", // Request balance from the operator
  SET_BALANCE: "operator_set_balance", // Send the balance to the iframe
  PAY_INVOICE: "operator_pay_invoice", // Pay an invoice
  CANCEL_INVOICE: "operator_cancel_invoice", // Cancel an invoice
});

/**
 * Tells the Clinch iframe that this invoice is not going to be paid and to disregard.
 */
export function cancelInvoice(invoice, origin) {
  postMessage({
    message: MessageTypes.CANCEL_INVOICE,
    invoice,
  }, origin);
}

/**
 * Initializes the Clinch SDK by listening for postMessage events from the iframe and responding accordingly.
 *
 * @async
 * @function loadClinch
 * @param {Object} config - Configuration object for the Clinch SDK.
 * @param {Function} getToken - Callback to retrieve the authentication token.
 * @param {Function} getBalance - Callback to retrieve the user's balance.
 * @param {Function} onPayInvoice - Callback to process invoice payments.
 */
export async function loadClinch(
  config,
  getToken,
  getBalance,
  onPayInvoice
) {
  const origin = config.clinchUrl;

  postMessage({
    message: MessageTypes.SET_CONFIG,
    config,
  }, origin);

  /**
   * Logs debug messages to the console when debug mode is enabled.
   *
   * @param {string} message - The debug message to be logged.
   */
  function logDebug(message) {
    if (config.logging) {
      console.debug(`Clinch SDK: ${message}`);
    }
  }

  /**
   * Event listener for incoming postMessage events from the Clinch iframe.
   * Handles messages based on their type (e.g., token requests, balance requests, etc.).
   */
  window.addEventListener("message", async function (event) {
    logDebug(`Received message from origin ${event.origin}`);
    
    // Validate the origin of the message
    if (!isMessageFromClinch(event, origin)) {
      logDebug("Message ignored: not from Clinch.");
      return;
    }

    // Parse the incoming message
    let messageData;
    try {
      messageData = JSON.parse(event.data);
      logDebug(`Parsed message: ${JSON.stringify(messageData)}`);
    } catch (e) {
      console.error("Clinch SDK: Failed to parse message data", e);
      return;
    }

    // Handle the message based on its type
    try {
      await handleMessage(messageData.message, messageData, origin, getToken, getBalance, onPayInvoice);
    } catch (e) {
      console.error("Clinch SDK: Error handling message", e);
    }
  });

  /**
   * Handles specific message types by executing the appropriate callback or action.
   *
   * @async
   * @function handleMessage
   * @param {string} message - The message type (e.g., GET_TOKEN).
   * @param {Object} messageData - The full message object received from the iframe.
   * @param {string} origin - The origin of the message (for validation).
   * @param {Function} getToken - Callback to retrieve the authentication token.
   * @param {Function} getBalance - Callback to retrieve the user's balance.
   * @param {Function} onPayInvoice - Callback to process invoice payments.
   */
  async function handleMessage(message, messageData, origin, getToken, getBalance, onPayInvoice) {
    logDebug(`Handling message: ${message}`);
    switch (message) {
      case MessageTypes.GET_CONFIG:
        postMessage({
          message: MessageTypes.SET_CONFIG,
          config: config,
        }, origin);
        logDebug("Sent config in response to SET_CONFIG");
        break;
      case MessageTypes.GET_TOKEN:
        postMessage({
          message: MessageTypes.SET_TOKEN,
          token: getToken(),
        }, origin);
        logDebug("Sent token in response to GET_TOKEN");
        break;
      case MessageTypes.PAY_INVOICE:
        onPayInvoice(messageData.data.invoice);
        logDebug(`Invoice received: ${JSON.stringify(messageData.data.invoice)}`);
        break;
      case MessageTypes.GET_BALANCE:
        const balance = getBalance();
        postMessage({
          message: MessageTypes.SET_BALANCE,
          balance: balance.balance,
          currency: balance.currency,
        }, origin);
        logDebug("Sent balance in response to GET_BALANCE");
        break;
      default:
        logDebug(`Unknown message type received: ${message}`);
    }
  }
}

/**
 * Validates if a message originates from the expected Clinch iframe.
 *
 * @function isMessageFromClinch
 * @param {Object} event - The postMessage event received from the iframe.
 * @param {string} origin - The expected origin of the iframe (for security validation).
 * @returns {boolean} - Returns true if the message is valid, false otherwise.
 */
function isMessageFromClinch(event, origin) {
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
 * Sends a message to the Clinch iframe via postMessage.
 *
 * @function postMessage
 * @param {Object} messageObject - The message object to send to the iframe.
 * @param {string} origin - The origin of the iframe (for security validation).
 */
function postMessage(messageObject, origin) {
  const messageJSON = JSON.stringify(messageObject);
  const iframe = document.querySelector("iframe");
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage(messageJSON, origin);
  } else {
    console.error("Clinch SDK: Unable to find the iframe");
  }
}
