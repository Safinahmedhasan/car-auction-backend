// controllers/vehicle.controller.js

const Vehicle = require("../models/vehicle.model");
const Auction = require("../models/auction.model");
const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require("../middleware/async");
const cloudinary = require("../utils/cloudinary");

exports.createVehicle = asyncHandler(async (req, res, next) => {
  req.body.createdBy = req.user.id;

  const vehicle = await Vehicle.create(req.body);

  res.status(201).json({
    success: true,
    data: vehicle,
  });
});

exports.getVehicles = asyncHandler(async (req, res, next) => {
  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude from filtering
  const removeFields = ["select", "sort", "page", "limit"];
  removeFields.forEach((param) => delete reqQuery[param]);

  // Create query string
  let queryStr = JSON.stringify(reqQuery);

  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(
    /\b(gt|gte|lt|lte|in)\b/g,
    (match) => `$${match}`
  );

  // Finding resource
  let query = Vehicle.find(JSON.parse(queryStr));

  // Select fields
  if (req.query.select) {
    const fields = req.query.select.split(",").join(" ");
    query = query.select(fields);
  }

  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(",").join(" ");
    query = query.sort(sortBy);
  } else {
    query = query.sort("-createdAt");
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Vehicle.countDocuments(JSON.parse(queryStr));

  query = query.skip(startIndex).limit(limit);

  // Execute query
  const vehicles = await query;

  // Pagination result
  const pagination = {};

  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit,
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit,
    };
  }

  res.status(200).json({
    success: true,
    count: vehicles.length,
    pagination,
    data: vehicles,
  });
});

exports.getVehicle = asyncHandler(async (req, res, next) => {
  const vehicle = await Vehicle.findById(req.params.id);

  if (!vehicle) {
    return next(
      new ErrorResponse(`Vehicle not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: vehicle,
  });
});

exports.updateVehicle = asyncHandler(async (req, res, next) => {
  let vehicle = await Vehicle.findById(req.params.id);

  if (!vehicle) {
    return next(
      new ErrorResponse(`Vehicle not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is vehicle creator or admin
  if (
    vehicle.createdBy.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(
      new ErrorResponse("Not authorized to update this vehicle", 403)
    );
  }

  // Update vehicle
  vehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: vehicle,
  });
});

exports.updateVehiclePhotos = asyncHandler(async (req, res, next) => {
  let vehicle = await Vehicle.findById(req.params.id);

  if (!vehicle) {
    return next(
      new ErrorResponse(`Vehicle not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is vehicle creator or admin
  if (
    vehicle.createdBy.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(
      new ErrorResponse("Not authorized to update this vehicle", 403)
    );
  }

  // Check if photos are provided
  if (
    !req.body.photos ||
    !Array.isArray(req.body.photos) ||
    req.body.photos.length === 0
  ) {
    return next(new ErrorResponse("Please provide photos array", 400));
  }

  // Update vehicle photos
  vehicle = await Vehicle.findByIdAndUpdate(
    req.params.id,
    {
      photos: req.body.photos,
      updatedAt: Date.now(),
    },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    success: true,
    data: {
      photos: vehicle.photos,
      _id: vehicle._id,
      updatedAt: vehicle.updatedAt,
    },
  });
});

exports.updateVehicleStatus = asyncHandler(async (req, res, next) => {
  let vehicle = await Vehicle.findById(req.params.id);

  if (!vehicle) {
    return next(
      new ErrorResponse(`Vehicle not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is vehicle creator or admin
  if (
    vehicle.createdBy.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(
      new ErrorResponse("Not authorized to update this vehicle", 403)
    );
  }

  // Check if status is provided
  if (!req.body.status) {
    return next(new ErrorResponse("Please provide status", 400));
  }

  // Update vehicle status
  vehicle = await Vehicle.findByIdAndUpdate(
    req.params.id,
    {
      status: req.body.status,
      updatedAt: Date.now(),
    },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    success: true,
    data: {
      _id: vehicle._id,
      status: vehicle.status,
      updatedAt: vehicle.updatedAt,
    },
  });
});

exports.deleteVehicle = asyncHandler(async (req, res, next) => {
  const vehicle = await Vehicle.findById(req.params.id);

  if (!vehicle) {
    return next(
      new ErrorResponse(`Vehicle not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is vehicle creator or admin
  if (
    vehicle.createdBy.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(
      new ErrorResponse("Not authorized to delete this vehicle", 403)
    );
  }

  // Delete photos from Cloudinary if they exist
  if (vehicle.photos && vehicle.photos.length > 0) {
    for (const photo of vehicle.photos) {
      if (photo.publicId) {
        await cloudinary.deleteImage(photo.publicId);
      }
    }
  }

  await vehicle.deleteOne();

  res.status(200).json({
    success: true,
    data: {},
  });
});

exports.searchVehicles = asyncHandler(async (req, res, next) => {
  const {
    query,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    make,
    model,
    bodyType,
    fuelType,
  } = req.query;

  const searchQuery = {};

  // Add text search if query is provided
  if (query) {
    searchQuery.$or = [
      { make: { $regex: query, $options: "i" } },
      { model: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ];
  }

  // Add price range if provided
  if (minPrice || maxPrice) {
    searchQuery.price = {};
    if (minPrice) searchQuery.price.$gte = parseInt(minPrice);
    if (maxPrice) searchQuery.price.$lte = parseInt(maxPrice);
  }

  // Add year range if provided
  if (minYear || maxYear) {
    searchQuery.year = {};
    if (minYear) searchQuery.year.$gte = parseInt(minYear);
    if (maxYear) searchQuery.year.$lte = parseInt(maxYear);
  }

  // Add specific filters if provided
  if (make) searchQuery.make = { $regex: make, $options: "i" };
  if (model) searchQuery.model = { $regex: model, $options: "i" };
  if (bodyType) searchQuery.bodyType = { $regex: bodyType, $options: "i" };
  if (fuelType) searchQuery.fuelType = fuelType;

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;

  const total = await Vehicle.countDocuments(searchQuery);

  // Execute query with pagination
  const vehicles = await Vehicle.find(searchQuery)
    .skip(startIndex)
    .limit(limit)
    .sort(req.query.sort || "-createdAt");

  // Pagination result
  const pagination = {};

  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit,
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit,
    };
  }

  res.status(200).json({
    success: true,
    count: vehicles.length,
    pagination,
    data: vehicles,
  });
});

exports.getVehiclesByMake = asyncHandler(async (req, res, next) => {
  const make = req.params.make;

  const vehicles = await Vehicle.find({
    make: { $regex: make, $options: "i" },
  });

  res.status(200).json({
    success: true,
    count: vehicles.length,
    data: vehicles,
  });
});

exports.moveVehicleToAuction = asyncHandler(async (req, res, next) => {
  const vehicle = await Vehicle.findById(req.params.id);

  if (!vehicle) {
    return next(
      new ErrorResponse(`Vehicle not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is vehicle creator or admin
  if (
    vehicle.createdBy.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(
      new ErrorResponse("Not authorized to update this vehicle", 403)
    );
  }

  // Check if auction details are provided
  if (!req.body.auctionDetails) {
    return next(new ErrorResponse("Please provide auction details", 400));
  }

  // Update vehicle status to auction
  await Vehicle.findByIdAndUpdate(req.params.id, {
    status: "auction",
    updatedAt: Date.now(),
  });

  // Create auction
  const auctionData = {
    ...req.body.auctionDetails,
    title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    description:
      vehicle.description ||
      `${vehicle.condition} condition ${vehicle.make} ${vehicle.model} with ${vehicle.mileage} miles.`,
    vehicleId: vehicle._id,
    createdBy: req.user.id,
    status: "draft",
  };

  const auction = await Auction.create(auctionData);

  res.status(200).json({
    success: true,
    data: {
      vehicle: {
        _id: vehicle._id,
        status: "auction",
        updatedAt: vehicle.updatedAt,
      },
      auction,
    },
  });
});
