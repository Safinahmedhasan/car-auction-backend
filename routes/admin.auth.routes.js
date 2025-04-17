// routes/admin.auth.routes.js

const express = require('express');
const {
  adminLogin,
  getAdminMe,
  adminLogout
} = require('../controllers/admin.auth.controller');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes - no protection needed
router.post('/login', adminLogin);

// Protected routes - need admin role
router.get('/me', protect, authorize('admin'), getAdminMe);
router.get('/logout', protect, authorize('admin'), adminLogout);

module.exports = router;