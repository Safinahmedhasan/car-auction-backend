// models/auction.model.js

const mongoose = require("mongoose");

const AuctionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Please add a title"],
    trim: true,
    maxlength: [100, "Title cannot be more than 100 characters"],
  },
  description: {
    type: String,
    required: [true, "Please add a description"],
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    required: [true, "Please add a vehicle"],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  startTime: {
    type: Date,
    required: [true, "Please add a start time"],
  },
  endTime: {
    type: Date,
    required: [true, "Please add an end time"],
  },
  actualEndTime: {
    type: Date,
  },
  startingPrice: {
    type: Number,
    required: [true, "Please add a starting price"],
  },
  currentPrice: {
    type: Number,
  },
  reservePrice: {
    type: Number,
  },
  minimumBidIncrement: {
    type: Number,
    default: 500,
  },
  bidTimeBuffer: {
    type: Number,
    default: 40,
    min: 15,
    max: 120,
  },
  bidFee: {
    type: Number,
    default: 0,
  },
  deliveryFee: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ["draft", "active", "ended", "completed", "cancelled"],
    default: "draft",
  },
  visibilityType: {
    type: String,
    enum: ["hidden", "visible", "latest-only"],
    default: "visible",
  },
  userType: {
    type: String,
    enum: ["all", "dealers-only", "individual-only"],
    default: "all",
  },
  // For parallel auctions (dealer vs general)
  isParallelAuction: {
    type: Boolean,
    default: false,
  },
  parallelAuctionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Auction",
  },
  // Pricing structure
  pricingCategory: {
    type: String,
    enum: ["standard", "premium", "dealer"],
    default: "standard",
  },
  winner: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    bidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bid",
    },
    notified: {
      type: Boolean,
      default: false,
    },
    notifiedAt: {
      type: Date,
    },
  },
  totalBids: {
    type: Number,
    default: 0,
  },
  views: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Set currentPrice equal to startingPrice when creating a new auction
AuctionSchema.pre("save", function (next) {
  if (this.isNew) {
    this.currentPrice = this.startingPrice;
  }
  this.updatedAt = Date.now();
  next();
});

// Middleware to ensure endTime is after startTime
AuctionSchema.pre("save", function (next) {
  if (this.endTime <= this.startTime) {
    const error = new Error("End time must be after start time");
    error.name = "ValidationError";
    next(error);
  } else {
    next();
  }
});

// Middleware to validate reservePrice is greater than startingPrice
AuctionSchema.pre("save", function (next) {
  if (this.reservePrice && this.reservePrice < this.startingPrice) {
    const error = new Error(
      "Reserve price must be greater than or equal to starting price"
    );
    error.name = "ValidationError";
    next(error);
  } else {
    next();
  }
});

// Method to extend the auction end time
AuctionSchema.methods.extendEndTime = function (seconds) {
  const currentEndTime = this.endTime || new Date();
  this.endTime = new Date(currentEndTime.getTime() + seconds * 1000);
  return this.endTime;
};

// Method to check if auction can be bid on
AuctionSchema.methods.isBiddable = function () {
  const now = new Date();
  return (
    this.status === "active" && this.startTime <= now && this.endTime > now
  );
};

// Method to check if a bid meets minimum increment
AuctionSchema.methods.meetsMinimumIncrement = function (bidAmount) {
  return bidAmount >= this.currentPrice + this.minimumBidIncrement;
};

// Method to check if a bid meets reserve price
AuctionSchema.methods.meetsReservePrice = function (bidAmount) {
  if (!this.reservePrice) return true;
  return bidAmount >= this.reservePrice;
};

module.exports = mongoose.model("Auction", AuctionSchema);
