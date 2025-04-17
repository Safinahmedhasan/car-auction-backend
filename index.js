// index.js
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (
    warning.name === "DeprecationWarning" &&
    warning.message.includes("punycode")
  ) {
    return;
  }
  // Log all other warnings
  console.warn(warning.name);
  console.warn(warning.message);
  console.warn(warning.stack);
});

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const xss = require("xss-clean");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
const mongoSanitize = require("express-mongo-sanitize");
const path = require("path");
const cron = require("node-cron");
require("dotenv").config();

// Import route files
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const adminAuthRoutes = require("./routes/admin.auth.routes");
const auctionRoutes = require("./routes/auction.routes");
const pricingRoutes = require("./routes/pricing.routes");
const vehicleRoutes = require("./routes/vehicle.routes"); 

// Import middleware
const errorHandler = require("./middleware/error");
const initializeAdmin = require("./middleware/adminInitializer");

// Import auction scheduler
const auctionScheduler = require("./utils/auctionScheduler");

// Initialize app
const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Security middleware
app.use(helmet());
app.use(xss());
app.use(mongoSanitize());

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// Prevent http param pollution
app.use(hpp());

// Enable CORS
app.use(cors());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// Serve admin interface
app.use("/admin", express.static(path.join(__dirname, "public/admin")));

// Connect to MongoDB and initialize admin
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    initializeAdmin();

    // Initialize auction scheduler
    auctionScheduler.initScheduler();
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Mount routers
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin/auth", adminAuthRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/auctions", auctionRoutes);
app.use("/api/v1/pricing", pricingRoutes);
app.use("/api/v1/vehicles", vehicleRoutes); // Mount vehicle routes

// Default route
app.get("/", (req, res) => {
  res.send("Car Auction API is running");
});

// Handle admin routes for SPA
app.get("/admin/*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin/index.html"));
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
