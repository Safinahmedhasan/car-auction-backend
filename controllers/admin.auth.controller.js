// controllers/admin.auth.controller.js

const User = require('../models/user.model');
const Admin = require('../models/admin.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

exports.adminLogin = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  // Check for user
  const user = await User.findOne({ email, role: 'admin' }).select('+password');

  if (!user) {
    return next(new ErrorResponse('Invalid admin credentials', 401));
  }

  // Check if user is active
  if (!user.isActive) {
    return next(new ErrorResponse('This admin account has been deactivated', 401));
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ErrorResponse('Invalid admin credentials', 401));
  }

  // Get admin permissions
  const adminData = await Admin.findOne({ userId: user._id });
  
  if (!adminData) {
    return next(new ErrorResponse('Admin permissions not found', 404));
  }

  // Update last login
  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  // Update admin last activity
  adminData.lastActivity = Date.now();
  await adminData.save();

  sendAdminTokenResponse(user, adminData, 200, res);
});

exports.getAdminMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized as an admin', 403));
  }

  const adminData = await Admin.findOne({ userId: user._id });

  if (!adminData) {
    return next(new ErrorResponse('Admin permissions not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      user,
      admin: adminData
    }
  });
});

exports.adminLogout = asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    data: {}
  });
});

// Helper function to get token from model, create cookie and send response
const sendAdminTokenResponse = (user, adminData, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res.status(statusCode).cookie('token', token, options).json({
    success: true,
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    },
    permissions: adminData.permissions
  });
};