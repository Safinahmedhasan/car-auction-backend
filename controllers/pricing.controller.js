// controllers/pricing.controller.js

const Pricing = require("../models/pricing.model");
const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require("../middleware/async");

exports.createPricing = asyncHandler(async (req, res, next) => {
  req.body.createdBy = req.user.id;

  const pricing = await Pricing.create(req.body);

  res.status(201).json({
    success: true,
    data: pricing,
  });
});

exports.getPricings = asyncHandler(async (req, res, next) => {
  const pricings = await Pricing.find().sort("category userType");

  res.status(200).json({
    success: true,
    count: pricings.length,
    data: pricings,
  });
});

exports.getPricing = asyncHandler(async (req, res, next) => {
  const pricing = await Pricing.findById(req.params.id);

  if (!pricing) {
    return next(
      new ErrorResponse(`Pricing not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: pricing,
  });
});

exports.updatePricing = asyncHandler(async (req, res, next) => {
  let pricing = await Pricing.findById(req.params.id);

  if (!pricing) {
    return next(
      new ErrorResponse(`Pricing not found with id of ${req.params.id}`, 404)
    );
  }

  // Update pricing
  pricing = await Pricing.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: pricing,
  });
});

exports.deletePricing = asyncHandler(async (req, res, next) => {
  const pricing = await Pricing.findById(req.params.id);

  if (!pricing) {
    return next(
      new ErrorResponse(`Pricing not found with id of ${req.params.id}`, 404)
    );
  }

  await pricing.deleteOne();

  res.status(200).json({
    success: true,
    data: {},
  });
});

exports.getPricingForUserType = asyncHandler(async (req, res, next) => {
  const { userType, category } = req.params;

  // Validate user type
  if (!["individual", "company", "dealer", "all"].includes(userType)) {
    return next(new ErrorResponse("Invalid user type", 400));
  }

  // Validate category
  if (!["standard", "premium", "dealer"].includes(category)) {
    return next(new ErrorResponse("Invalid pricing category", 400));
  }

  const pricing = await Pricing.getPricingForUser(userType, category);

  if (!pricing) {
    return next(
      new ErrorResponse(
        `No pricing found for ${userType} users in ${category} category`,
        404
      )
    );
  }

  res.status(200).json({
    success: true,
    data: pricing,
  });
});

exports.calculateFees = asyncHandler(async (req, res, next) => {
  const { price, userType, category } = req.body;

  if (!price || price <= 0) {
    return next(new ErrorResponse("Please provide a valid price", 400));
  }

  // Default to standard pricing for all users if not specified
  const userTypeToUse = userType || "all";
  const categoryToUse = category || "standard";

  const pricing = await Pricing.getPricingForUser(userTypeToUse, categoryToUse);

  if (!pricing) {
    return next(
      new ErrorResponse(
        `No pricing found for ${userTypeToUse} users in ${categoryToUse} category`,
        404
      )
    );
  }

  const fees = pricing.calculateTotalFees(price);

  res.status(200).json({
    success: true,
    data: {
      price,
      userType: userTypeToUse,
      category: categoryToUse,
      fees,
    },
  });
});
