const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

let isConfigured = false;

// Configure Cloudinary via CLOUDINARY_URL or individual keys
if (process.env.CLOUDINARY_URL) {
  try {
    cloudinary.config({
      cloudinary_url: process.env.CLOUDINARY_URL
    });
    isConfigured = true;
    console.log('[CloudMedia] Cloudinary CDN configured via CLOUDINARY_URL.');
  } catch (e) {
    console.warn('[CloudMedia] Error parsing CLOUDINARY_URL:', e.message);
  }
} else if (
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  isConfigured = true;
  console.log(`[CloudMedia] Cloudinary CDN configured for cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);
} else {
  console.log('[CloudMedia] Cloudinary credentials not detected. Active Storage: Local Disk (/uploads) fallback.');
}

/**
 * Upload a multer file object to Cloudinary with automatic local fallback
 * @param {Object} file - Express/Multer file object
 * @param {string} folder - Destination folder on Cloudinary
 * @returns {Promise<{ url: string, storage: 'cloudinary' | 'local', publicId?: string }>}
 */
async function uploadMedia(file, folder = 'hdtalk') {
  if (!file) return null;

  if (isConfigured && file.path && fs.existsSync(file.path)) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder,
        resource_type: 'auto'
      });

      // Remove local temp file since it is now permanently hosted on Cloudinary
      try {
        fs.unlinkSync(file.path);
      } catch (_) {}

      return {
        url: result.secure_url,
        storage: 'cloudinary',
        publicId: result.public_id,
        bytes: result.bytes,
        format: result.format
      };
    } catch (uploadErr) {
      console.warn('[CloudMedia] Cloudinary upload exception, falling back to local file:', uploadErr.message);
      return {
        url: `/uploads/${file.filename}`,
        storage: 'local'
      };
    }
  }

  // Graceful local disk fallback
  return {
    url: `/uploads/${file.filename}`,
    storage: 'local'
  };
}

/**
 * Check if Cloudinary cloud storage is active
 */
function getStorageStatus() {
  return {
    isConfigured,
    engine: isConfigured ? 'Cloudinary CDN (Permanent Cloud Media)' : 'Local Disk (Fallback /uploads)',
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || (process.env.CLOUDINARY_URL ? 'Configured via URL' : null)
  };
}

module.exports = {
  uploadMedia,
  getStorageStatus,
  isConfigured: () => isConfigured
};
