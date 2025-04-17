// middleware/upload.

const multer = require('multer');
const ErrorResponse = require('../utils/errorResponse');

// Set storage to memory storage
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)) {
    return cb(new ErrorResponse('Please upload a valid image file', 400), false);
  }
  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, 
  fileFilter: fileFilter
});

module.exports = upload;