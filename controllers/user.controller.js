// controllers/user.controller.js

const User = require("../models/user.model");
const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require("../middleware/async");
const cloudinary = require("../utils/cloudinary");

exports.register = asyncHandler(async (req, res, next) => {
  const {
    username,
    email,
    password,
    role,
    firstName,
    lastName,
    companyName,
    phoneNumber,
    address,
  } = req.body;

  // Create user
  const user = await User.create({
    username,
    email,
    password,
    role,
    firstName,
    lastName,
    companyName,
    phoneNumber,
    address,
  });

  sendTokenResponse(user, 201, res);
});

exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    return next(new ErrorResponse("Please provide an email and password", 400));
  }

  // Check for user
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return next(new ErrorResponse("Invalid credentials", 401));
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ErrorResponse("Invalid credentials", 401));
  }

  // Update last login
  user.lastLogin = Date.now();
  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, res);
});

exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});

exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: user,
  });
});

// Fixed updateDetails function
exports.updateDetails = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  // Fields to update
  const fieldsToUpdate = {};

  // Only add fields that are present in the request
  if (req.body.firstName !== undefined)
    fieldsToUpdate.firstName = req.body.firstName;
  if (req.body.lastName !== undefined)
    fieldsToUpdate.lastName = req.body.lastName;
  if (req.body.email !== undefined) fieldsToUpdate.email = req.body.email;
  if (req.body.companyName !== undefined)
    fieldsToUpdate.companyName = req.body.companyName;
  if (req.body.phoneNumber !== undefined)
    fieldsToUpdate.phoneNumber = req.body.phoneNumber;

  // Handle address fields if any address field is provided
  if (req.body.address) {
    fieldsToUpdate.address = {};

    if (req.body.address.street !== undefined)
      fieldsToUpdate.address.street = req.body.address.street;
    if (req.body.address.city !== undefined)
      fieldsToUpdate.address.city = req.body.address.city;
    if (req.body.address.state !== undefined)
      fieldsToUpdate.address.state = req.body.address.state;
    if (req.body.address.zipCode !== undefined)
      fieldsToUpdate.address.zipCode = req.body.address.zipCode;
    if (req.body.address.country !== undefined)
      fieldsToUpdate.address.country = req.body.address.country;
  }

  // Always update the updatedAt field
  fieldsToUpdate.updatedAt = Date.now();

  // Update user
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    fieldsToUpdate,
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    success: true,
    data: updatedUser,
  });
});

exports.updateProfileWithPhoto = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  // Fields to update
  const fieldsToUpdate = {};

  // Only add fields that are present in the request
  if (req.body.firstName !== undefined)
    fieldsToUpdate.firstName = req.body.firstName;
  if (req.body.lastName !== undefined)
    fieldsToUpdate.lastName = req.body.lastName;
  if (req.body.email !== undefined) fieldsToUpdate.email = req.body.email;
  if (req.body.companyName !== undefined)
    fieldsToUpdate.companyName = req.body.companyName;
  if (req.body.phoneNumber !== undefined)
    fieldsToUpdate.phoneNumber = req.body.phoneNumber;

  // Handle address fields if any address field is provided
  if (req.body.address) {
    fieldsToUpdate.address = {};

    if (req.body.address.street !== undefined)
      fieldsToUpdate.address.street = req.body.address.street;
    if (req.body.address.city !== undefined)
      fieldsToUpdate.address.city = req.body.address.city;
    if (req.body.address.state !== undefined)
      fieldsToUpdate.address.state = req.body.address.state;
    if (req.body.address.zipCode !== undefined)
      fieldsToUpdate.address.zipCode = req.body.address.zipCode;
    if (req.body.address.country !== undefined)
      fieldsToUpdate.address.country = req.body.address.country;
  }

  // Handle profile photo upload if a file is provided
  if (req.file) {
    if (user.profilePhoto && user.profilePhoto.publicId) {
      await cloudinary.deleteImage(user.profilePhoto.publicId);
    }

    // Upload new image to Cloudinary
    const result = await cloudinary.uploadImage(
      req.file,
      `car-auction/users/${user._id}`
    );

    // Update user profile photo
    fieldsToUpdate.profilePhoto = {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }

  // Always update the updatedAt field
  fieldsToUpdate.updatedAt = Date.now();

  // Update user
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    fieldsToUpdate,
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    success: true,
    data: updatedUser,
  });
});

exports.deleteProfilePhoto = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  // If user has a profile photo, delete it from Cloudinary
  if (user.profilePhoto && user.profilePhoto.publicId) {
    await cloudinary.deleteImage(user.profilePhoto.publicId);
  }

  // Reset profile photo fields
  user.profilePhoto = {
    url: "",
    publicId: "",
  };
  user.updatedAt = Date.now();

  await user.save();

  res.status(200).json({
    success: true,
    data: {
      profilePhoto: user.profilePhoto,
    },
  });
});

exports.updatePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");

  // Check current password
  if (!(await user.matchPassword(req.body.currentPassword))) {
    return next(new ErrorResponse("Password is incorrect", 401));
  }

  user.password = req.body.newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
});

exports.verifyBankId = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  user.bankIdVerified = true;
  user.updatedAt = Date.now();
  await user.save();

  res.status(200).json({
    success: true,
    message: "BankID verification successful",
    data: {
      bankIdVerified: user.bankIdVerified,
    },
  });
});

const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === "production") {
    options.secure = true;
  }

  res.status(statusCode).cookie("token", token, options).json({
    success: true,
    token,
  });
};

// logout function in user
exports.logout = asyncHandler(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // If a token exists, we'll clear it properly
  if (token) {
    res.cookie("token", "none", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    if (req.user) {
      req.user.lastLogout = Date.now();
      await User.findByIdAndUpdate(
        req.user.id,
        { lastLogout: Date.now() },
        { new: false }
      );
    }
  }

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
    data: {},
  });
});
