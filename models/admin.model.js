// models/admin.model.js

const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  permissions: {
    manageUsers: {
      type: Boolean,
      default: true
    },
    manageAuctions: {
      type: Boolean,
      default: true
    },
    manageVehicles: {
      type: Boolean, 
      default: true
    },
    manageBids: {
      type: Boolean,
      default: true
    },
    viewReports: {
      type: Boolean,
      default: true
    },
    manageSettings: {
      type: Boolean,
      default: true
    }
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date
  }
});

// Pre-save middleware to update the updatedAt field
AdminSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Admin', AdminSchema);