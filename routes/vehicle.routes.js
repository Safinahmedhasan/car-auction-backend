// routes/vehicle.routes.js

const express = require('express');
const router = express.Router();

// Import controllers
const {
  createVehicle,
  getVehicles,
  getVehicle,
  updateVehicle,
  updateVehiclePhotos,
  updateVehicleStatus,
  deleteVehicle,
  searchVehicles,
  getVehiclesByMake,
  moveVehicleToAuction
} = require('../controllers/vehicle.controller');

// Import middleware
const { protect, authorize } = require('../middleware/auth');
const { checkPermission } = require('../middleware/adminPermissions');
const upload = require('../middleware/upload');

// Public routes
router.get('/', getVehicles);
router.get('/search', searchVehicles);
router.get('/make/:make', getVehiclesByMake);
router.get('/:id', getVehicle);

// Protected routes
router.use(protect); // All routes below this require authentication

// Create vehicle (all authorized users can create)
router.post('/', authorize('admin', 'dealer', 'individual', 'company'), createVehicle);

// Update routes
router.put('/:id', authorize('admin', 'dealer', 'individual', 'company'), updateVehicle);
router.put('/:id/photos', authorize('admin', 'dealer', 'individual', 'company'), updateVehiclePhotos);
router.patch('/:id/status', authorize('admin', 'dealer', 'individual', 'company'), updateVehicleStatus);
router.put('/:id/auction', authorize('admin', 'dealer', 'individual', 'company'), moveVehicleToAuction);

// Delete route
router.delete('/:id', authorize('admin', 'dealer', 'individual', 'company'), deleteVehicle);

// Admin-only routes
router.get('/admin/all', protect, authorize('admin'), checkPermission('manageVehicles'), async (req, res) => {
  req.query.limit = 100; // Override limit for admin views
  return getVehicles(req, res);
});

module.exports = router;