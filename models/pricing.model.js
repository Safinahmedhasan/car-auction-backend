// models/pricing.model.js

const mongoose = require("mongoose");

const PricingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please add a pricing name"],
    unique: true,
    trim: true,
  },
  category: {
    type: String,
    enum: ["standard", "premium", "dealer"],
    required: [true, "Please specify a pricing category"],
  },
  userType: {
    type: String,
    enum: ["individual", "company", "dealer", "all", "user"], // Added 'user' to support existing data
    required: [true, "Please specify user type"],
  },
  bidFee: {
    type: Number,
    default: 0,
  },
  deliveryFee: {
    type: Number,
    default: 0,
  },
  commissionPercentage: {
    type: Number,
    default: 0,
  },
  minCommission: {
    type: Number,
    default: 0,
  },
  maxCommission: {
    type: Number,
    default: 0,
  },
  flatFee: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
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

// Pre-save middleware
PricingSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get pricing based on user type and category
PricingSchema.statics.getPricingForUser = async function (
  userType,
  category = "standard"
) {
  // Map 'user' to 'individual' for compatibility
  const normalizedUserType = userType === "user" ? "individual" : userType;

  // First try to find pricing specific to the user type and category
  let pricing = await this.findOne({
    userType: normalizedUserType,
    category: category,
    isActive: true,
  });

  // If no specific pricing is found, try with 'all' user type
  if (!pricing) {
    pricing = await this.findOne({
      userType: "all",
      category: category,
      isActive: true,
    });
  }

  // If still no pricing found, get the standard pricing for all users
  if (!pricing) {
    pricing = await this.findOne({
      userType: "all",
      category: "standard",
      isActive: true,
    });
  }

  return pricing;
};

// Method to calculate the commission for a given price
PricingSchema.methods.calculateCommission = function (price) {
  const percentage = this.commissionPercentage / 100;
  const commission = price * percentage;

  // Apply minimum and maximum limits
  if (this.minCommission && commission < this.minCommission) {
    return this.minCommission;
  }
  if (this.maxCommission && commission > this.maxCommission) {
    return this.maxCommission;
  }

  return commission;
};

// Method to calculate the total fees for a given price
PricingSchema.methods.calculateTotalFees = function (price) {
  const commission = this.calculateCommission(price);
  return {
    bidFee: this.bidFee,
    deliveryFee: this.deliveryFee,
    commission: commission,
    flatFee: this.flatFee,
    total: this.bidFee + this.deliveryFee + commission + this.flatFee,
  };
};

module.exports = mongoose.model("Pricing", PricingSchema);
