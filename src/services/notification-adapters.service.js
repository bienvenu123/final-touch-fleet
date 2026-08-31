const adapters = new Map();

function normalizeChannel(channel) {
  const normalized = String(channel || "").trim().toUpperCase();
  if (!['EMAIL', 'SMS', 'PUSH'].includes(normalized)) {
    throw new Error("channel must be EMAIL, SMS, or PUSH");
  }
  return normalized;
}

function registerNotificationAdapter(channel, adapter) {
  const normalizedChannel = normalizeChannel(channel);
  if (!adapter || typeof adapter.send !== "function") {
    throw new Error("A notification adapter must provide a send(notification) function");
  }
  adapters.set(normalizedChannel, adapter);
  return () => adapters.delete(normalizedChannel);
}

function getNotificationAdapter(channel) {
  return adapters.get(normalizeChannel(channel));
}

// These factories keep provider SDKs out of the domain service. Inject the provider
// call during application bootstrap, then register the resulting adapter.
function createEmailAdapter(sendEmail) {
  return {
    send: (notification) => sendEmail({
      to: notification.recipient,
      subject: notification.subject,
      text: notification.message,
      html: notification.payload?.html,
      attachments: notification.payload?.attachments,
      payload: notification.payload,
    }),
  };
}

function createSmsAdapter(sendSms) {
  return { send: (notification) => sendSms({ to: notification.recipient, message: notification.message, payload: notification.payload }) };
}

function createPushAdapter(sendPush) {
  return { send: (notification) => sendPush({ token: notification.recipient, title: notification.subject, body: notification.message, payload: notification.payload }) };
}

module.exports = { normalizeChannel, registerNotificationAdapter, getNotificationAdapter, createEmailAdapter, createSmsAdapter, createPushAdapter };
