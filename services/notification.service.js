// services/notification.service.js

const User = require("../models/user.model");
const Auction = require("../models/auction.model");
const Vehicle = require("../models/vehicle.model");

// Mock email service - replace with actual email service in production
const sendEmail = async (to, subject, body) => {
  console.log(`Email sent to ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body}`);

  // In production, integrate with actual email service like SendGrid, Mailgun, etc.
  return true;
};

// Mock SMS service - replace with actual SMS service in production
const sendSMS = async (to, message) => {
  console.log(`SMS sent to ${to}`);
  console.log(`Message: ${message}`);

  // In production, integrate with actual SMS service like Twilio, Nexmo, etc.
  return true;
};

// Auction bid notification
exports.sendBidNotification = async (auction, bid, outbidUserId) => {
  try {
    // Get auction creator
    const creator = await User.findById(auction.createdBy);

    // Get vehicle details
    const vehicle = await Vehicle.findById(auction.vehicleId);

    // Notify auction creator about new bid
    if (creator && creator.email) {
      await sendEmail(
        creator.email,
        `New bid on your auction: ${auction.title}`,
        `A new bid of $${bid.amount} has been placed on your auction for ${vehicle.make} ${vehicle.model}.`
      );
    }

    // Notify outbid user if applicable
    if (outbidUserId) {
      const outbidUser = await User.findById(outbidUserId);

      if (outbidUser && outbidUser.email) {
        await sendEmail(
          outbidUser.email,
          `You have been outbid on ${auction.title}`,
          `Your bid on ${vehicle.make} ${vehicle.model} has been outbid. The current highest bid is now $${bid.amount}.`
        );
      }
    }

    return true;
  } catch (error) {
    console.error("Notification failed:", error);
    return false;
  }
};

// Auction ending soon notification
exports.sendAuctionEndingSoonNotification = async (auction) => {
  try {
    // Get all bidders for this auction
    const bids = await Bid.find({ auctionId: auction._id }).distinct("userId");

    // Get vehicle details
    const vehicle = await Vehicle.findById(auction.vehicleId);

    // Send notification to each bidder
    for (const userId of bids) {
      const user = await User.findById(userId);

      if (user && user.email) {
        await sendEmail(
          user.email,
          `Auction ending soon: ${auction.title}`,
          `The auction for ${vehicle.make} ${vehicle.model} will end in 1 hour. Current highest bid: $${auction.currentPrice}.`
        );
      }
    }

    return true;
  } catch (error) {
    console.error("Notification failed:", error);
    return false;
  }
};

// Auction ended notification
exports.sendAuctionEndedNotification = async (auction) => {
  try {
    // Get auction creator
    const creator = await User.findById(auction.createdBy);

    // Get vehicle details
    const vehicle = await Vehicle.findById(auction.vehicleId);

    // Notify auction creator
    if (creator && creator.email) {
      await sendEmail(
        creator.email,
        `Your auction has ended: ${auction.title}`,
        `Your auction for ${vehicle.make} ${vehicle.model} has ended with a final price of $${auction.currentPrice}.`
      );
    }

    return true;
  } catch (error) {
    console.error("Notification failed:", error);
    return false;
  }
};

// Winner notification
exports.sendWinnerNotification = async (winner, auction) => {
  try {
    // Get vehicle details
    const vehicle = await Vehicle.findById(auction.vehicleId);

    // Send email notification
    if (winner.email) {
      await sendEmail(
        winner.email,
        `Congratulations! You won the auction for ${auction.title}`,
        `You have won the auction for ${vehicle.make} ${vehicle.model} with a bid of $${auction.currentPrice}. Please contact us to arrange payment and delivery.`
      );
    }

    // Send SMS notification if phone number is available
    if (winner.phoneNumber) {
      await sendSMS(
        winner.phoneNumber,
        `Congratulations! You won the auction for ${vehicle.make} ${vehicle.model} with a bid of $${auction.currentPrice}.`
      );
    }

    return true;
  } catch (error) {
    console.error("Winner notification failed:", error);
    return false;
  }
};

// Reserve price not met notification
exports.sendReserveNotMetNotification = async (auction) => {
  try {
    // Get auction creator
    const creator = await User.findById(auction.createdBy);

    // Get vehicle details
    const vehicle = await Vehicle.findById(auction.vehicleId);

    // Notify auction creator
    if (creator && creator.email) {
      await sendEmail(
        creator.email,
        `Reserve price not met for ${auction.title}`,
        `Your auction for ${vehicle.make} ${vehicle.model} has ended, but the reserve price of $${auction.reservePrice} was not met. The highest bid was $${auction.currentPrice}.`
      );
    }

    return true;
  } catch (error) {
    console.error("Notification failed:", error);
    return false;
  }
};

// Auction time extension notification
exports.sendTimeExtensionNotification = async (auction, newEndTime) => {
  try {
    // Get all bidders for this auction
    const bids = await Bid.find({ auctionId: auction._id }).distinct("userId");

    // Send notification to each bidder
    for (const userId of bids) {
      const user = await User.findById(userId);

      if (user && user.email) {
        const formattedEndTime = new Date(newEndTime).toLocaleString();

        await sendEmail(
          user.email,
          `Auction time extended: ${auction.title}`,
          `Due to last-minute bidding, the auction end time has been extended to ${formattedEndTime}.`
        );
      }
    }

    return true;
  } catch (error) {
    console.error("Notification failed:", error);
    return false;
  }
};
