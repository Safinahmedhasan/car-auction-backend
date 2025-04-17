// models/vehicle.model.js

const mongoose = require("mongoose");

const VehicleSchema = new mongoose.Schema({
  make: {
    type: String,
    required: [true, "Please add a make"],
    trim: true,
  },
  model: {
    type: String,
    required: [true, "Please add a model"],
    trim: true,
  },
  year: {
    type: Number,
    required: [true, "Please add a year"],
    min: [1900, "Year must be after 1900"],
    max: [new Date().getFullYear() + 1, "Year cannot be in the future"],
  },
  trim: {
    type: String,
    trim: true,
  },
  color: {
    type: String,
    trim: true,
  },
  bodyType: {
    type: String,
    trim: true,
  },
  fuelType: {
    type: String,
    enum: [
      "gasoline",
      "diesel",
      "electric",
      "hybrid",
      "plug-in hybrid",
      "other",
    ],
    default: "gasoline",
  },
  transmission: {
    type: String,
    enum: ["automatic", "manual", "semi-automatic", "cvt", "other"],
    default: "automatic",
  },
  mileage: {
    type: Number,
    min: 0,
  },
  vin: {
    type: String,
    trim: true,
  },
  licensePlate: {
    type: String,
    trim: true,
  },
  condition: {
    type: String,
    enum: ["new", "like new", "excellent", "good", "fair", "poor"],
    default: "good",
  },
  description: {
    type: String,
  },
  photos: [
    {
      url: {
        type: String,
      },
      publicId: {
        type: String,
      },
      isFeatured: {
        type: Boolean,
        default: false,
      },
    },
  ],
  specifications: {
    engineSize: String,
    horsePower: Number,
    doors: Number,
    seats: Number,
    acceleration: String,
    topSpeed: String,
    weight: String,
    dimensions: {
      length: String,
      width: String,
      height: String,
    },
  },
  features: [String],
  history: {
    owners: Number,
    accidents: Number,
    serviceRecords: Boolean,
    lastServiceDate: Date,
  },
  price: {
    type: Number,
  },
  status: {
    type: String,
    enum: ["available", "reserved", "sold", "auction", "hidden"],
    default: "available",
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

// Add index for search performance
VehicleSchema.index({ make: 1, model: 1, year: 1 });
VehicleSchema.index({ status: 1 });
VehicleSchema.index({ createdBy: 1 });

VehicleSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Vehicle", VehicleSchema);
