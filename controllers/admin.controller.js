// controllers/admin.controller.js

const Admin = require("../models/admin.model");
const User = require("../models/user.model");
const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require("../middleware/async");

exports.getAdminProfile = asyncHandler(async (req, res, next) => {
  const adminData = await Admin.findOne({ userId: req.user.id });

  if (!adminData) {
    return next(new ErrorResponse("Admin profile not found", 404));
  }

  res.status(200).json({
    success: true,
    data: adminData,
  });
});

exports.updateAdminPermissions = asyncHandler(async (req, res, next) => {
  // Check if requesting admin is the main admin
  const requestingAdmin = await Admin.findOne({ userId: req.user.id });

  if (!requestingAdmin) {
    return next(new ErrorResponse("Admin profile not found", 404));
  }

  const adminToUpdate = await Admin.findById(req.params.adminId);

  if (!adminToUpdate) {
    return next(
      new ErrorResponse(`Admin with id ${req.params.adminId} not found`, 404)
    );
  }

  // Update permissions
  if (req.body.permissions) {
    adminToUpdate.permissions = {
      ...adminToUpdate.permissions,
      ...req.body.permissions,
    };
  }

  if (req.body.notes) {
    adminToUpdate.notes = req.body.notes;
  }

  adminToUpdate.updatedAt = Date.now();
  await adminToUpdate.save();

  res.status(200).json({
    success: true,
    data: adminToUpdate,
  });
});

exports.getAllAdmins = asyncHandler(async (req, res, next) => {
  const admins = await Admin.find().populate({
    path: "userId",
    select: "username email firstName lastName lastLogin isActive",
  });

  res.status(200).json({
    success: true,
    count: admins.length,
    data: admins,
  });
});

exports.createAdminEntry = asyncHandler(async (req, res, next) => {
  // Check if user exists and is not already an admin
  const user = await User.findById(req.params.userId);

  if (!user) {
    return next(
      new ErrorResponse(`User with id ${req.params.userId} not found`, 404)
    );
  }

  // Check if user already has an admin entry
  const existingAdmin = await Admin.findOne({ userId: req.params.userId });

  if (existingAdmin) {
    return next(
      new ErrorResponse(`Admin entry already exists for this user`, 400)
    );
  }

  // Update user role to admin
  user.role = "admin";
  await user.save();

  // Create new admin entry
  const adminData = await Admin.create({
    userId: req.params.userId,
    permissions: req.body.permissions || {
      manageUsers: true,
      manageAuctions: true,
      manageVehicles: true,
      manageBids: true,
      viewReports: true,
      manageSettings: true,
    },
    notes:
      req.body.notes ||
      `Admin created by ${req.user.username} on ${new Date().toISOString()}`,
  });

  res.status(201).json({
    success: true,
    data: adminData,
  });
});

exports.removeAdminStatus = asyncHandler(async (req, res, next) => {
  // Cannot remove yourself
  if (req.params.userId === req.user.id.toString()) {
    return next(new ErrorResponse("Cannot remove your own admin status", 400));
  }

  // Find user and admin entry
  const user = await User.findById(req.params.userId);

  if (!user) {
    return next(
      new ErrorResponse(`User with id ${req.params.userId} not found`, 404)
    );
  }

  const adminEntry = await Admin.findOne({ userId: req.params.userId });

  if (!adminEntry) {
    return next(new ErrorResponse(`Admin entry not found for this user`, 404));
  }

  // Remove admin entry
  await adminEntry.deleteOne();

  // Update user role
  user.role = "individual";
  await user.save();

  res.status(200).json({
    success: true,
    data: {},
  });
});

exports.getDashboardStats = asyncHandler(async (req, res, next) => {
  const userCount = await User.countDocuments();
  const adminCount = await Admin.countDocuments();
  const activeUserCount = await User.countDocuments({ isActive: true });

  // Get counts by user role
  const individualCount = await User.countDocuments({ role: "individual" });
  const companyCount = await User.countDocuments({ role: "company" });
  const dealerCount = await User.countDocuments({ role: "dealer" });

  // Get recent users (last 7 days)
  const lastWeekDate = new Date();
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);

  const newUsersCount = await User.countDocuments({
    createdAt: { $gte: lastWeekDate },
  });

  res.status(200).json({
    success: true,
    data: {
      userStats: {
        total: userCount,
        active: activeUserCount,
        new: newUsersCount,
        byRole: {
          individual: individualCount,
          company: companyCount,
          dealer: dealerCount,
          admin: adminCount,
        },
      },
    },
  });
});
