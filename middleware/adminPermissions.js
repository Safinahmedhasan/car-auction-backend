// middleware/adminPermissions.js

const Admin = require('../models/admin.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('./async');

/**
 * @param {...String} permissions 
 * @returns {Function} 
 */
exports.checkPermission = (...permissions) => {
  return asyncHandler(async (req, res, next) => {
    if (req.user.role !== 'admin') {
      return next(new ErrorResponse('Not authorized to access this route', 403));
    }
    
    // Find admin permissions
    const adminData = await Admin.findOne({ userId: req.user.id });
    
    if (!adminData) {
      return next(new ErrorResponse('Admin permissions not found', 404));
    }
    
    // Check if admin has all required permissions
    const hasAllPermissions = permissions.every(
      permission => adminData.permissions[permission] === true
    );
    
    if (!hasAllPermissions) {
      return next(
        new ErrorResponse('You do not have permission to perform this action', 403)
      );
    }
    
    // Attach admin data to request
    req.adminData = adminData;
    next();
  });
};