const unavailableMongoErrors = new Set([
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
  'MongoPoolClearedError',
  'MongoServerSelectionError',
  'MongoTopologyClosedError',
  'MongooseServerSelectionError',
]);
const unavailableNetworkCodes = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ETIMEDOUT',
]);

function getStatusCode(error, fallbackStatus) {
  if (error?.statusCode) return error.statusCode;
  if (error?.name === 'ValidationError' || error?.name === 'CastError' || error?.type === 'entity.parse.failed') return 400;
  if (error?.type === 'entity.too.large') return 413;
  if (error?.code === 11000) return 409;
  if (
    unavailableMongoErrors.has(error?.name) ||
    unavailableNetworkCodes.has(error?.code) ||
    unavailableNetworkCodes.has(error?.cause?.code)
  ) {
    return 503;
  }
  return fallbackStatus;
}

function safeMessage(error) {
  let message = String(error?.message || 'Unknown error');
  for (const secret of [process.env.MONGODB_URI, process.env.GEMINI_API_KEY]) {
    if (secret) message = message.split(secret).join('[REDACTED]');
  }
  return message.replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[REDACTED_MONGODB_URI]');
}

export function sendApiError(res, error, fallbackStatus = 500) {
  const status = getStatusCode(error, fallbackStatus);
  console.error('API request failed:', {
    status,
    name: error?.name || 'Error',
    code: error?.code || null,
  });

  const message =
    status === 503
      ? 'Database unavailable. Please try again later.'
      : status >= 500
        ? 'Internal server error.'
        : safeMessage(error) || 'Request failed.';

  return res.status(status).json({ success: false, message });
}
