const env = require('../config/env');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'حدث خطأ في الخادم الداخلي';
  let code = err.code || 'INTERNAL_SERVER_ERROR';

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
    code = 'VALIDATION_ERROR';
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'معرف غير صالح';
    code = 'INVALID_ID';
  }

  // Handle Duplicate Key Error (MongoDB)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `القيمة الخاصة بالحقل ${field} موجودة بالفعل`;
    code = 'DUPLICATE_KEY';
  }

  // Handle JWT Error
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'رمز التحقق غير صالح';
    code = 'AUTH_004';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'انتهت صلاحية رمز التحقق';
    code = 'AUTH_004';
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
    statusCode,
    stack: env.nodeEnv === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;
