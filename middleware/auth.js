// middleware/auth.js

const jwt = require("jsonwebtoken");
const asyncHandler = require("./async");
const ErrorResponse = require("../utils/errorResponse");
const User = require("../models/user.model");

// Protect routes
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {

    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return next(new ErrorResponse("Not authorized to access this route", 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token has expired
    const now = Date.now() / 1000;
    if (decoded.exp <= now) {
      return next(new ErrorResponse("Token expired, please login again", 401));
    }

    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new ErrorResponse("User no longer exists", 401));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new ErrorResponse("User account is deactivated", 401));
    }

    req.user = user;
    next();
  } catch (err) {
    return next(new ErrorResponse("Not authorized to access this route", 401));
  }
});

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role ${req.user.role} is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};

// Check BankID verification
exports.requireBankId = asyncHandler(async (req, res, next) => {
  if (!req.user.bankIdVerified) {
    return next(
      new ErrorResponse("This action requires BankID verification", 403)
    );
  }
  next();
});
