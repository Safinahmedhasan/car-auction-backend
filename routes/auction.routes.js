// routes/auction.routes.js

const express = require("express");
const router = express.Router();
const {
  createAuction,
  getAuctions,
  getAuction,
  updateAuction,
  deleteAuction,
  activateAuction,
  endAuction,
  getAuctionBids,
  getAuctionWinner,
  placeBid,
  notifyWinner,
  completeAuction,
  cancelAuction,
} = require("../controllers/auction.controller");

const { protect, authorize, requireBankId } = require("../middleware/auth");
const { checkPermission } = require("../middleware/adminPermissions");

// Public routes
router.get("/", getAuctions);
router.get("/:id", getAuction);
router.get("/:id/bids", getAuctionBids);

// Protected routes
router.use(protect);

// Routes that require BankID verification
router.post("/:id/bids", requireBankId, placeBid);

// Routes for auction creators and admins
router.post(
  "/",
  authorize("admin", "dealer", "individual", "company", "user"),
  createAuction
);
router.put(
  "/:id",
  authorize("admin", "dealer", "individual", "company"),
  updateAuction
);
router.delete(
  "/:id",
  authorize("admin", "dealer", "individual", "company"),
  deleteAuction
);
router.put(
  "/:id/activate",
  authorize("admin", "dealer", "individual", "company"),
  activateAuction
);
router.put(
  "/:id/end",
  authorize("admin", "dealer", "individual", "company"),
  endAuction
);
router.get(
  "/:id/winner",
  authorize("admin", "dealer", "individual", "company"),
  getAuctionWinner
);
router.post(
  "/:id/notify-winner",
  authorize("admin", "dealer", "individual", "company"),
  notifyWinner
);
router.put(
  "/:id/complete",
  authorize("admin", "dealer", "individual", "company"),
  completeAuction
);
router.put(
  "/:id/cancel",
  authorize("admin", "dealer", "individual", "company"),
  cancelAuction
);

// Admin-only routes
router.get(
  "/admin/all",
  protect,
  authorize("admin"),
  checkPermission("manageAuctions"),
  async (req, res) => {
    req.query.limit = 100;
    return getAuctions(req, res);
  }
);

module.exports = router;
