const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');

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
 * Upload a base64 encoded image to Cloudinary or fallback to local disk
 * @param {string} base64Data - Base64 data URL (e.g. data:image/png;base64,...)
 * @param {string} folder - Destination folder on Cloudinary
 * @returns {Promise<{ url: string, storage: 'cloudinary' | 'local' | 'inline', publicId?: string }>}
 */
async function uploadBase64(base64Data, folder = 'hdtalk/avatars') {
  if (!base64Data || typeof base64Data !== 'string') return null;

  if (isConfigured) {
    try {
      const result = await cloudinary.uploader.upload(base64Data, {
        folder,
        resource_type: 'image'
      });

      return {
        url: result.secure_url,
        storage: 'cloudinary',
        publicId: result.public_id,
        bytes: result.bytes,
        format: result.format
      };
    } catch (uploadErr) {
      console.warn('[CloudMedia] Cloudinary base64 upload exception, falling back to local file:', uploadErr.message);
    }
  }

  // Graceful local disk fallback
  try {
    const matches = base64Data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (matches) {
      const rawSubtype = matches[1].toLowerCase();
      const ext = rawSubtype === 'jpeg' ? '.jpg' : `.${rawSubtype}`;
      const safeExt = ['.jpg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.png';
      const filename = `avatar-${Date.now()}-${uuidv4().slice(0, 8)}${safeExt}`;
      const filePath = path.join(config.UPLOAD_DIR, filename);
      const buffer = Buffer.from(matches[2], 'base64');
      await fs.promises.writeFile(filePath, buffer);
      return {
        url: `/uploads/${filename}`,
        storage: 'local'
      };
    }
  } catch (saveErr) {
    console.warn('[CloudMedia] Could not persist base64 avatar to disk:', saveErr.message);
  }

  return {
    url: base64Data,
    storage: 'inline'
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
  uploadBase64,
  getStorageStatus,
  isConfigured: () => isConfigured
};
