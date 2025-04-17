// middleware/adminInitializer.js

const User = require('../models/user.model');
const Admin = require('../models/admin.model');
const asyncHandler = require('./async');


const initializeAdmin = asyncHandler(async () => {
  console.log('Checking for admin user...');
  
  // Check if any admin user exists
  const adminExists = await User.findOne({ role: 'admin' });
  
  if (!adminExists) {
    console.log('No admin user found. Creating default admin user...');
    
    // Create default admin user from environment variables
    const adminUser = await User.create({
      username: process.env.DEFAULT_ADMIN_USERNAME,
      email: process.env.DEFAULT_ADMIN_EMAIL,
      password: process.env.DEFAULT_ADMIN_PASSWORD,
      role: 'admin',
      firstName: 'System',
      lastName: 'Administrator',
      bankIdVerified: true,
      isActive: true
    });
    
    // Create an entry in the Admin collection with full permissions
    await Admin.create({
      userId: adminUser._id,
      permissions: {
        manageUsers: true,
        manageAuctions: true,
        manageVehicles: true,
        manageBids: true,
        viewReports: true,
        manageSettings: true
      },
      notes: 'Default system administrator'
    });
    
    console.log('Default admin user created successfully with admin permissions');
  } else {
    console.log('Admin user already exists');
    
    // Check if admin has an entry in Admin collection
    const adminEntry = await Admin.findOne({ userId: adminExists._id });
    
    if (!adminEntry) {
      console.log('Creating admin permissions entry for existing admin user...');
      await Admin.create({
        userId: adminExists._id,
        permissions: {
          manageUsers: true,
          manageAuctions: true,
          manageVehicles: true,
          manageBids: true,
          viewReports: true,
          manageSettings: true
        },
        notes: 'Auto-generated for existing admin'
      });
      console.log('Admin permissions created successfully');
    }
  }
});

module.exports = initializeAdmin;