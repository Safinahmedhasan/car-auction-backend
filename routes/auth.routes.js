// routes/auth.routes.js

const express = require("express");
const {
  register,
  login,
  logout,
  getMe,
  updateDetails,
  updatePassword,
  verifyBankId,
  updateProfileWithPhoto,
  deleteProfilePhoto,
} = require("../controllers/user.controller");

const { protect } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/logout", logout);
router.get("/me", protect, getMe);

// Fixed route for updating user details
router.put("/updatedetails", protect, updateDetails);

// New combined route for updating profile with optional photo
router.put("/profile", protect, upload.single("photo"), updateProfileWithPhoto);

router.put("/updatepassword", protect, updatePassword);
router.post("/bankid/verify", protect, verifyBankId);

// Route for deleting profile photo
router.delete("/profile-photo", protect, deleteProfilePhoto);

module.exports = router;
