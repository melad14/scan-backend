const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const Technician = require('../models/Technician');
const Admin = require('../models/Admin');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, env.jwt.accessSecret);

      // Attach token payload to request
      req.user = {
        id: decoded.id,
        role: decoded.role
      };

      // Optional: Check if user still exists and is active in database
      let dbUser;
      if (decoded.role === 'patient') {
        dbUser = await User.findById(decoded.id);
      } else if (decoded.role === 'technician') {
        dbUser = await Technician.findById(decoded.id);
      } else if (decoded.role === 'admin' || decoded.role === 'super_admin') {
        dbUser = await Admin.findById(decoded.id);
      }

      if (!dbUser || !dbUser.isActive) {
        return res.status(401).json({
          success: false,
          message: 'الحساب غير موجود أو تم إيقافه',
          code: 'AUTH_003',
          statusCode: 401
        });
      }

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({
        success: false,
        message: 'غير مصرح بالدخول، الرمز غير صالح',
        code: 'AUTH_004',
        statusCode: 401
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'غير مصرح بالدخول، لم يتم توفير رمز التحقق',
      code: 'AUTH_004',
      statusCode: 401
    });
  }
};

// Role authorization check middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح لك بإجراء هذه العملية',
        code: 'AUTH_005',
        statusCode: 403
      });
    }
    next();
  };
};

module.exports = {
  protect,
  authorize
};
