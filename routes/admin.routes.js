// routes/admin.routes.js

const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const { protect, authorize } = require('../middleware/auth');
const { checkPermission } = require('../middleware/adminPermissions');

// Import admin controller
const {
  getAdminProfile,
  updateAdminPermissions,
  getAllAdmins,
  createAdminEntry,
  removeAdminStatus,
  getDashboardStats
} = require('../controllers/admin.controller');

// Apply protection and admin authorization to all routes
router.use(protect);
router.use(authorize('admin'));

// Admin profile and management routes
router.get('/profile', getAdminProfile);
router.get('/admins', checkPermission('manageUsers'), getAllAdmins);
router.post('/admins/:userId', checkPermission('manageUsers'), createAdminEntry);
router.put('/permissions/:adminId', checkPermission('manageUsers'), updateAdminPermissions);
router.delete('/admins/:userId', checkPermission('manageUsers'), removeAdminStatus);
router.get('/dashboard', checkPermission('viewReports'), getDashboardStats);


router.get('/users', checkPermission('manageUsers'), asyncHandler(async (req, res, next) => {
  const users = await User.find();
  
  res.status(200).json({
    success: true,
    count: users.length,
    data: users
  });
}));


router.get('/users/:id', checkPermission('manageUsers'), asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }
  
  res.status(200).json({
    success: true,
    data: user
  });
}));


router.post('/users', checkPermission('manageUsers'), asyncHandler(async (req, res, next) => {
  const user = await User.create(req.body);
  
  res.status(201).json({
    success: true,
    data: user
  });
}));


router.put('/users/:id', checkPermission('manageUsers'), asyncHandler(async (req, res, next) => {
  let user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }
  
  // Add updated timestamp
  req.body.updatedAt = Date.now();
  
  user = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  res.status(200).json({
    success: true,
    data: user
  });
}));


router.delete('/users/:id', checkPermission('manageUsers'), asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }
  
  await user.deleteOne();
  
  res.status(200).json({
    success: true,
    data: {}
  });
}));


router.put('/users/:id/role', checkPermission('manageUsers'), asyncHandler(async (req, res, next) => {
  const { role } = req.body;
  
  if (!role) {
    return next(new ErrorResponse('Role is required', 400));
  }
  
  if (!['individual', 'company', 'dealer', 'admin'].includes(role)) {
    return next(new ErrorResponse('Invalid role', 400));
  }
  
  let user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }
  
  user = await User.findByIdAndUpdate(
    req.params.id, 
    { role, updatedAt: Date.now() }, 
    { new: true, runValidators: true }
  );
  
  res.status(200).json({
    success: true,
    data: user
  });
}));

router.put('/users/:id/status', checkPermission('manageUsers'), asyncHandler(async (req, res, next) => {
  const { isActive } = req.body;
  
  if (isActive === undefined) {
    return next(new ErrorResponse('isActive status is required', 400));
  }
  
  let user = await User.findById(req.params.id);
  
  if (!user) {
    return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
  }
  
  user = await User.findByIdAndUpdate(
    req.params.id, 
    { isActive, updatedAt: Date.now() }, 
    { new: true, runValidators: true }
  );
  
  res.status(200).json({
    success: true,
    data: user
  });
}));

module.exports = router;