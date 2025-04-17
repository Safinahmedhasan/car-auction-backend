// controllers/auction.controller.js

const Auction = require("../models/auction.model");
const Bid = require("../models/bid.model");
const Pricing = require("../models/pricing.model");
const Vehicle = require("../models/vehicle.model");
const User = require("../models/user.model");
const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require("../middleware/async");
const notificationService = require("../services/notification.service");

exports.createAuction = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.createdBy = req.user.id;

  // Validate vehicle exists
  if (req.body.vehicleId) {
    const vehicle = await Vehicle.findById(req.body.vehicleId);
    if (!vehicle) {
      return next(
        new ErrorResponse(
          `Vehicle not found with id of ${req.body.vehicleId}`,
          404
        )
      );
    }
  }

  // Apply pricing based on auction configuration
  if (req.body.pricingCategory) {
    const pricing = await Pricing.getPricingForUser(
      req.body.userType === "dealers-only" ? "dealer" : "all",
      req.body.pricingCategory
    );

    if (pricing) {
      req.body.bidFee = pricing.bidFee;
      req.body.deliveryFee = pricing.deliveryFee;
    }
  }

  // Create auction
  const auction = await Auction.create(req.body);

  // If this is part of a parallel auction system, create the partner auction
  if (req.body.isParallelAuction && !req.body.parallelAuctionId) {
    // Determine the complementary user type
    const complementaryUserType =
      req.body.userType === "dealers-only" ? "individual-only" : "dealers-only";

    // Create a parallel auction with different pricing and user type
    const parallelPricing = await Pricing.getPricingForUser(
      complementaryUserType === "dealers-only" ? "dealer" : "individual",
      req.body.pricingCategory
    );

    const parallelAuctionData = {
      ...req.body,
      userType: complementaryUserType,
      isParallelAuction: true,
      parallelAuctionId: auction._id,
      bidFee: parallelPricing ? parallelPricing.bidFee : req.body.bidFee,
      deliveryFee: parallelPricing
        ? parallelPricing.deliveryFee
        : req.body.deliveryFee,
    };

    const parallelAuction = await Auction.create(parallelAuctionData);

    // Update the original auction with the parallel auction ID
    auction.parallelAuctionId = parallelAuction._id;
    await auction.save();
  }

  res.status(201).json({
    success: true,
    data: auction,
  });
});

exports.getAuctions = asyncHandler(async (req, res, next) => {
  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude from filtering
  const removeFields = ["select", "sort", "page", "limit"];
  removeFields.forEach((param) => delete reqQuery[param]);

  // Filter by user type if not admin
  if (req.user && req.user.role !== "admin") {
    if (req.user.role === "dealer") {
      reqQuery.$or = [{ userType: "dealers-only" }, { userType: "all" }];
    } else {
      reqQuery.$or = [{ userType: "individual-only" }, { userType: "all" }];
    }
  }

  // Create query string
  let queryStr = JSON.stringify(reqQuery);

  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(
    /\b(gt|gte|lt|lte|in)\b/g,
    (match) => `$${match}`
  );

  // Finding resource
  let query = Auction.find(JSON.parse(queryStr)).populate({
    path: "vehicleId",
    select: "make model year photos",
  });

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
  const total = await Auction.countDocuments(JSON.parse(queryStr));

  query = query.skip(startIndex).limit(limit);

  // Execute query
  const auctions = await query;

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
    count: auctions.length,
    pagination,
    data: auctions,
  });
});

exports.getAuction = asyncHandler(async (req, res, next) => {
  const auction = await Auction.findById(req.params.id)
    .populate({
      path: "vehicleId",
      select: "make model year photos specifications description",
    })
    .populate({
      path: "createdBy",
      select: "username",
    });

  if (!auction) {
    return next(
      new ErrorResponse(`Auction not found with id of ${req.params.id}`, 404)
    );
  }

  // Check user type visibility restrictions
  if (req.user && req.user.role !== "admin") {
    if (auction.userType === "dealers-only" && req.user.role !== "dealer") {
      return next(
        new ErrorResponse("Not authorized to view this auction", 403)
      );
    }

    if (auction.userType === "individual-only" && req.user.role === "dealer") {
      return next(
        new ErrorResponse("Not authorized to view this auction", 403)
      );
    }
  }

  // Increment views counter
  auction.views += 1;
  await auction.save();

  res.status(200).json({
    success: true,
    data: auction,
  });
});

exports.updateAuction = asyncHandler(async (req, res, next) => {
  let auction = await Auction.findById(req.params.id);

  if (!auction) {
    return next(
      new ErrorResponse(`Auction not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is auction creator or admin
  if (
    auction.createdBy.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(
      new ErrorResponse("Not authorized to update this auction", 403)
    );
  }

  // Can't update if auction is active or completed
  if (["active", "completed"].includes(auction.status)) {
    return next(
      new ErrorResponse(`Cannot update ${auction.status} auction`, 400)
    );
  }

  // Update auction
  auction = await Auction.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  // If this is a parallel auction, update the partner as well
  if (auction.isParallelAuction && auction.parallelAuctionId) {
    const syncFields = {
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      startingPrice: req.body.startingPrice,
      reservePrice: req.body.reservePrice,
      minimumBidIncrement: req.body.minimumBidIncrement,
      bidTimeBuffer: req.body.bidTimeBuffer,
      status: req.body.status,
    };

    // Filter out undefined values
    Object.keys(syncFields).forEach((key) => {
      if (syncFields[key] === undefined) {
        delete syncFields[key];
      }
    });

    // Only update if there are fields to sync
    if (Object.keys(syncFields).length > 0) {
      await Auction.findByIdAndUpdate(auction.parallelAuctionId, syncFields, {
        runValidators: true,
      });
    }
  }

  res.status(200).json({
    success: true,
    data: auction,
  });
});

exports.deleteAuction = asyncHandler(async (req, res, next) => {
  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    return next(
      new ErrorResponse(`Auction not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is auction creator or admin
  if (
    auction.createdBy.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(
      new ErrorResponse("Not authorized to delete this auction", 403)
    );
  }

  // Can't delete if auction is active or completed
  if (["active", "completed"].includes(auction.status)) {
    return next(
      new ErrorResponse(`Cannot delete ${auction.status} auction`, 400)
    );
  }

  // Delete parallel auction if exists
  if (auction.isParallelAuction && auction.parallelAuctionId) {
    await Auction.findByIdAndDelete(auction.parallelAuctionId);
  }

  await auction.deleteOne();

  res.status(200).json({
    success: true,
    data: {},
  });
});

exports.activateAuction = asyncHandler(async (req, res, next) => {
  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    return next(
      new ErrorResponse(`Auction not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is auction creator or admin
  if (
    auction.createdBy.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(
      new ErrorResponse("Not authorized to activate this auction", 403)
    );
  }

  // Can only activate draft auctions
  if (auction.status !== "draft") {
    return next(
      new ErrorResponse(`Cannot activate ${auction.status} auction`, 400)
    );
  }

  // Make sure start time is in the future
  const now = new Date();
  if (auction.startTime <= now) {
    return next(new ErrorResponse("Start time must be in the future", 400));
  }

  // Activate auction
  auction.status = "active";
  await auction.save();

  // Activate parallel auction if exists
  if (auction.isParallelAuction && auction.parallelAuctionId) {
    await Auction.findByIdAndUpdate(auction.parallelAuctionId, {
      status: "active",
    });
  }

  res.status(200).json({
    success: true,
    data: auction,
  });
});

exports.endAuction = asyncHandler(async (req, res, next) => {
  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    return next(
      new ErrorResponse(`Auction not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is auction creator or admin
  if (
    auction.createdBy.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(new ErrorResponse("Not authorized to end this auction", 403));
  }

  // Can only end active auctions
  if (auction.status !== "active") {
    return next(new ErrorResponse(`Cannot end ${auction.status} auction`, 400));
  }

  // End auction
  auction.status = "ended";
  auction.actualEndTime = new Date();
  await auction.save();

  // Process auction result (determine winner)
  await processAuctionResult(auction._id);

  // End parallel auction if exists
  if (auction.isParallelAuction && auction.parallelAuctionId) {
    const parallelAuction = await Auction.findById(auction.parallelAuctionId);
    if (parallelAuction && parallelAuction.status === "active") {
      parallelAuction.status = "ended";
      parallelAuction.actualEndTime = new Date();
      await parallelAuction.save();
      await processAuctionResult(parallelAuction._id);
    }
  }

  res.status(200).json({
    success: true,
    data: auction,
  });
});

exports.getAuctionBids = asyncHandler(async (req, res, next) => {
  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    return next(
      new ErrorResponse(`Auction not found with id of ${req.params.id}`, 404)
    );
  }

  // Check user type visibility restrictions
  if (req.user && req.user.role !== "admin") {
    if (auction.userType === "dealers-only" && req.user.role !== "dealer") {
      return next(
        new ErrorResponse("Not authorized to view this auction", 403)
      );
    }

    if (auction.userType === "individual-only" && req.user.role === "dealer") {
      return next(
        new ErrorResponse("Not authorized to view this auction", 403)
      );
    }
  }

  // Check bid visibility settings
  if (
    auction.visibilityType === "hidden" &&
    req.user.role !== "admin" &&
    auction.createdBy.toString() !== req.user.id
  ) {
    return next(
      new ErrorResponse("Bid history is not visible for this auction", 403)
    );
  }

  let query = Bid.find({ auctionId: req.params.id })
    .sort("-createdAt")
    .populate({
      path: "userId",
      select: "username",
    });

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Bid.countDocuments({ auctionId: req.params.id });

  // If visibilityType is 'latest-only' and user is not admin or creator, limit to only the latest bid
  if (
    auction.visibilityType === "latest-only" &&
    req.user.role !== "admin" &&
    auction.createdBy.toString() !== req.user.id
  ) {
    query = Bid.find({ auctionId: req.params.id })
      .sort("-createdAt")
      .limit(1)
      .populate({
        path: "userId",
        select: "username",
      });
  } else {
    query = query.skip(startIndex).limit(limit);
  }

  const bids = await query;

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
    count: bids.length,
    pagination,
    data: bids,
  });
});

exports.getAuctionWinner = asyncHandler(async (req, res, next) => {
  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    return next(
      new ErrorResponse(`Auction not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is auction creator, winner, or admin
  if (
    auction.createdBy.toString() !== req.user.id &&
    req.user.role !== "admin" &&
    (!auction.winner || auction.winner.userId.toString() !== req.user.id)
  ) {
    return next(
      new ErrorResponse("Not authorized to view winner information", 403)
    );
  }

  if (!auction.winner || !auction.winner.userId) {
    return next(
      new ErrorResponse("No winner has been determined for this auction", 404)
    );
  }

  // Get winner information
  const winner = await User.findById(auction.winner.userId).select(
    "username firstName lastName email phoneNumber"
  );
  const winningBid = await Bid.findById(auction.winner.bidId);

  res.status(200).json({
    success: true,
    data: {
      winner,
      winningBid,
      notified: auction.winner.notified,
      notifiedAt: auction.winner.notifiedAt,
    },
  });
});

exports.placeBid = asyncHandler(async (req, res, next) => {
  const { amount } = req.body;
  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    return next(
      new ErrorResponse(`Auction not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if auction is biddable
  if (!auction.isBiddable()) {
    return next(
      new ErrorResponse("This auction is not currently accepting bids", 400)
    );
  }

  // Check user type restrictions
  if (auction.userType === "dealers-only" && req.user.role !== "dealer") {
    return next(new ErrorResponse("Only dealers can bid on this auction", 403));
  }

  if (auction.userType === "individual-only" && req.user.role === "dealer") {
    return next(new ErrorResponse("Dealers cannot bid on this auction", 403));
  }

  // Check if bid amount meets minimum increment
  if (!auction.meetsMinimumIncrement(amount)) {
    return next(
      new ErrorResponse(
        `Bid must be at least ${
          auction.currentPrice + auction.minimumBidIncrement
        }`,
        400
      )
    );
  }

  // Get pricing for bid fee calculation
  const pricing = await Pricing.getPricingForUser(
    req.user.role,
    auction.pricingCategory
  );

  // Create bid
  const bid = await Bid.create({
    auctionId: auction._id,
    userId: req.user.id,
    amount,
    bidFee: pricing ? pricing.bidFee : auction.bidFee,
    ip: req.ip,
    userAgent: req.headers["user-agent"] || "Unknown",
    status: "valid",
  });

  // Update auction with new highest bid
  auction.currentPrice = amount;
  auction.totalBids += 1;

  // Extend auction end time if bid is placed near the end
  const now = new Date();
  const timeRemaining = (auction.endTime.getTime() - now.getTime()) / 1000; // in seconds

  if (timeRemaining < auction.bidTimeBuffer) {
    auction.extendEndTime(auction.bidTimeBuffer);
  }

  await auction.save();

  // Mark previous bids as outbid
  await Bid.updateMany(
    {
      auctionId: auction._id,
      status: "valid",
      _id: { $ne: bid._id },
    },
    { status: "outbid" }
  );

  // If this is a parallel auction, sync the bid to the other auction
  if (auction.isParallelAuction && auction.parallelAuctionId) {
    // Get the parallel auction
    const parallelAuction = await Auction.findById(auction.parallelAuctionId);

    if (parallelAuction && parallelAuction.status === "active") {
      // Update parallel auction with the same bid amount
      parallelAuction.currentPrice = amount;
      parallelAuction.totalBids += 1;

      // Extend end time if necessary
      if (timeRemaining < parallelAuction.bidTimeBuffer) {
        parallelAuction.extendEndTime(parallelAuction.bidTimeBuffer);
      }

      await parallelAuction.save();

      // Mark previous bids as outbid
      await Bid.updateMany(
        {
          auctionId: parallelAuction._id,
          status: "valid",
        },
        { status: "outbid" }
      );

      // Create a system bid in the parallel auction
      await Bid.create({
        auctionId: parallelAuction._id,
        userId: req.user.id,
        amount,
        bidFee: 0,
        isAutoBid: true,
        status: "valid",
        ip: req.ip,
        userAgent: "System generated bid",
      });
    }
  }

  res.status(201).json({
    success: true,
    data: bid,
  });
});

exports.notifyWinner = asyncHandler(async (req, res, next) => {
  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    return next(
      new ErrorResponse(`Auction not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is auction creator or admin
  if (
    auction.createdBy.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(new ErrorResponse("Not authorized to notify winner", 403));
  }

  // Check if auction has a winner
  if (!auction.winner || !auction.winner.userId) {
    return next(
      new ErrorResponse("No winner has been determined for this auction", 404)
    );
  }

  // Check if winner has already been notified
  if (auction.winner.notified) {
    return next(new ErrorResponse("Winner has already been notified", 400));
  }

  // Get winner information
  const winner = await User.findById(auction.winner.userId);

  if (!winner) {
    return next(new ErrorResponse("Winner user account not found", 404));
  }

  // Send notification to winner
  try {
    await notificationService.sendWinnerNotification(winner, auction);

    // Update auction with notification status
    auction.winner.notified = true;
    auction.winner.notifiedAt = Date.now();
    await auction.save();

    res.status(200).json({
      success: true,
      data: {
        notified: true,
        notifiedAt: auction.winner.notifiedAt,
      },
    });
  } catch (err) {
    return next(
      new ErrorResponse("Failed to send notification to winner", 500)
    );
  }
});

exports.completeAuction = asyncHandler(async (req, res, next) => {
  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    return next(
      new ErrorResponse(`Auction not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is auction creator or admin
  if (
    auction.createdBy.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(
      new ErrorResponse("Not authorized to complete this auction", 403)
    );
  }

  // Can only complete ended auctions
  if (auction.status !== "ended") {
    return next(
      new ErrorResponse(`Cannot complete ${auction.status} auction`, 400)
    );
  }

  // Complete auction
  auction.status = "completed";
  await auction.save();

  // Complete parallel auction if exists
  if (auction.isParallelAuction && auction.parallelAuctionId) {
    const parallelAuction = await Auction.findById(auction.parallelAuctionId);
    if (parallelAuction && parallelAuction.status === "ended") {
      parallelAuction.status = "completed";
      await parallelAuction.save();
    }
  }

  res.status(200).json({
    success: true,
    data: auction,
  });
});

exports.cancelAuction = asyncHandler(async (req, res, next) => {
  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    return next(
      new ErrorResponse(`Auction not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is auction creator or admin
  if (
    auction.createdBy.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(
      new ErrorResponse("Not authorized to cancel this auction", 403)
    );
  }

  // Can't cancel completed auctions
  if (auction.status === "completed") {
    return next(new ErrorResponse("Cannot cancel a completed auction", 400));
  }

  // Cancel auction
  auction.status = "cancelled";
  await auction.save();

  // Cancel all valid bids
  await Bid.updateMany(
    { auctionId: auction._id, status: "valid" },
    { status: "cancelled" }
  );

  // Cancel parallel auction if exists
  if (auction.isParallelAuction && auction.parallelAuctionId) {
    const parallelAuction = await Auction.findById(auction.parallelAuctionId);
    if (parallelAuction) {
      parallelAuction.status = "cancelled";
      await parallelAuction.save();

      // Cancel all valid bids in parallel auction
      await Bid.updateMany(
        { auctionId: parallelAuction._id, status: "valid" },
        { status: "cancelled" }
      );
    }
  }

  res.status(200).json({
    success: true,
    data: auction,
  });
});

// Helper function to process auction results and determine winner
const processAuctionResult = async (auctionId) => {
  const auction = await Auction.findById(auctionId);

  if (!auction) {
    throw new Error(`Auction not found with id of ${auctionId}`);
  }

  // Get highest bid
  const highestBid = await Bid.findOne({
    auctionId: auction._id,
    status: "valid",
  }).sort("-amount");

  if (highestBid) {
    // Check if bid meets reserve price if set
    if (auction.reservePrice && highestBid.amount < auction.reservePrice) {
      return;
    }

    // Set the winning bid
    highestBid.status = "winning";
    highestBid.isWinningBid = true;
    await highestBid.save();

    // Update the auction with winner info
    auction.winner = {
      userId: highestBid.userId,
      bidId: highestBid._id,
      notified: false,
    };
    await auction.save();
  }
};
