// utils/auctionScheduler.js

const cron = require("node-cron");
const Auction = require("../models/auction.model");
const Bid = require("../models/bid.model");
const notificationService = require("../services/notification.service");

// Start auctions that have reached their start time
const startScheduledAuctions = async () => {
  const now = new Date();

  try {
    // Find auctions that should start now
    const auctions = await Auction.find({
      status: "draft",
      startTime: { $lte: now },
    });

    console.log(`Starting ${auctions.length} scheduled auctions`);

    for (const auction of auctions) {
      auction.status = "active";
      await auction.save();
      console.log(`Auction ${auction._id} is now active`);
    }
  } catch (error) {
    console.error("Error starting scheduled auctions:", error);
  }
};

// End auctions that have reached their end time
const endExpiredAuctions = async () => {
  const now = new Date();

  try {
    // Find auctions that should end now
    const auctions = await Auction.find({
      status: "active",
      endTime: { $lte: now },
    });

    console.log(`Ending ${auctions.length} expired auctions`);

    for (const auction of auctions) {
      auction.status = "ended";
      auction.actualEndTime = now;
      await auction.save();
      console.log(`Auction ${auction._id} has ended`);

      // Process auction result
      await processAuctionResult(auction._id);

      // Send auction ended notification
      await notificationService.sendAuctionEndedNotification(auction);
    }
  } catch (error) {
    console.error("Error ending expired auctions:", error);
  }
};

// Send notifications for auctions ending soon (e.g., in 1 hour)
const notifyAuctionsEndingSoon = async () => {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  try {
    // Find auctions ending in approximately 1 hour
    const auctions = await Auction.find({
      status: "active",
      endTime: {
        $gt: now,
        $lt: oneHourFromNow,
      },
    });

    console.log(
      `Sending notifications for ${auctions.length} auctions ending soon`
    );

    for (const auction of auctions) {
      await notificationService.sendAuctionEndingSoonNotification(auction);
    }
  } catch (error) {
    console.error("Error sending auction ending soon notifications:", error);
  }
};

// Process the result of an ended auction
const processAuctionResult = async (auctionId) => {
  try {
    const auction = await Auction.findById(auctionId);

    if (!auction || auction.status !== "ended") {
      return;
    }

    // Get highest bid
    const highestBid = await Bid.findOne({
      auctionId: auction._id,
      status: "valid",
    }).sort("-amount");

    if (highestBid) {
      // Check if bid meets reserve price if set
      if (auction.reservePrice && highestBid.amount < auction.reservePrice) {
        // Reserve price not met
        console.log(`Reserve price not met for auction ${auction._id}`);
        await notificationService.sendReserveNotMetNotification(auction);
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

      console.log(`Winner determined for auction ${auction._id}`);
    } else {
      console.log(`No bids for auction ${auction._id}`);
    }
  } catch (error) {
    console.error(`Error processing auction result for ${auctionId}:`, error);
  }
};

// Initialize all scheduler tasks
const initScheduler = () => {
  cron.schedule("* * * * *", startScheduledAuctions);

  cron.schedule("* * * * *", endExpiredAuctions);

  cron.schedule("0 * * * *", notifyAuctionsEndingSoon);

  console.log("Auction scheduler initialized");
};

module.exports = {
  initScheduler,
  startScheduledAuctions,
  endExpiredAuctions,
  notifyAuctionsEndingSoon,
  processAuctionResult,
};
