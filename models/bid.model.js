// models/bid.model.js

const mongoose = require('mongoose');

const BidSchema = new mongoose.Schema({
  auctionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auction',
    required: [true, 'Please add an auction ID']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please add a user ID']
  },
  amount: {
    type: Number,
    required: [true, 'Please add a bid amount']
  },
  bidFee: {
    type: Number,
    default: 0
  },
  isAutoBid: {
    type: Boolean,
    default: false
  },
  maxAutoBidAmount: {
    type: Number
  },
  isWinningBid: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'valid', 'invalid', 'outbid', 'winning', 'cancelled'],
    default: 'pending'
  },
  invalidReason: {
    type: String,
    enum: ['below_minimum', 'auction_ended', 'auction_not_active', 'duplicate', 'user_not_eligible', null],
    default: null
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware
BidSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster bid retrieval
BidSchema.index({ auctionId: 1, createdAt: -1 });
BidSchema.index({ userId: 1, createdAt: -1 });
BidSchema.index({ auctionId: 1, amount: -1 });

module.exports = mongoose.model('Bid', BidSchema);