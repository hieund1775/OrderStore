/**
 * Central Error Handler Middleware
 * Distinguishes between client errors (4xx) and internal errors (5xx).
 * In production, masks internal SQL/database/system errors to prevent sensitive data leaks.
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const requestId = req.id || 'req_unknown';

  // Determine status code
  let status = err.status || err.statusCode;
  if (!status || typeof status !== 'number' || status < 400 || status > 599) {
    status = 500;
  }

  // Internal log with request ID
  if (status >= 500) {
    console.error(`❌ [SERVER_ERROR] [${requestId}] ${req.method} ${req.originalUrl || req.url}:`, err.stack || err.message);
  } else {
    console.warn(`⚠️ [CLIENT_ERROR] [${requestId}] ${req.method} ${req.originalUrl || req.url} (${status}):`, err.message);
  }

  // Client errors (4xx) can safely expose their expected messages
  if (status < 500) {
    return res.status(status).json({
      error: err.message || 'Yêu cầu không hợp lệ',
      code: err.code || 'BAD_REQUEST',
      requestId,
    });
  }

  // Server errors (500)
  if (isProduction) {
    return res.status(500).json({
      error: 'Hệ thống đang bận. Vui lòng thử lại sau.',
      code: 'INTERNAL_SERVER_ERROR',
      requestId,
    });
  }

  // In development/test, provide error message for easier debugging
  return res.status(500).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
    requestId,
    stack: err.stack,
  });
}

/**
 * Legacy routes still build some 5xx JSON responses themselves instead of
 * forwarding errors. Keep production responses safe until those routes are
 * migrated to the central async boundary.
 */
export function sanitizeLegacyErrorResponses(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (process.env.NODE_ENV === 'production' && res.statusCode >= 500) {
      return originalJson({
        error: 'Hệ thống đang bận. Vui lòng thử lại sau.',
        code: 'INTERNAL_SERVER_ERROR',
        requestId: req.id || 'req_unknown',
      });
    }
    return originalJson(body);
  };

  next();
}
