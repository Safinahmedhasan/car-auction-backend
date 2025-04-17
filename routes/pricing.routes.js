// routes/pricing.routes.js

const express = require("express");
const router = express.Router();

const {
  createPricing,
  getPricings,
  getPricing,
  updatePricing,
  deletePricing,
  getPricingForUserType,
  calculateFees,
} = require("../controllers/pricing.controller");

// Import middleware
const { protect, authorize } = require("../middleware/auth");
const { checkPermission } = require("../middleware/adminPermissions");

// Public routes
router.get("/for/:userType/:category", getPricingForUserType);
router.post("/calculate", calculateFees);

// Route to create pricing - allowing all authenticated users
router.post("/", protect, createPricing);

// Protected routes (Admin only)
router.use(protect);
router.use(authorize("admin"));
router.use(checkPermission("manageSettings"));

// Admin-only routes
router.get("/", getPricings);
router.route("/:id").get(getPricing).put(updatePricing).delete(deletePricing);

module.exports = router;
