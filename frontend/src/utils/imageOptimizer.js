/**
 * High-Speed Image URL Optimizer
 * Transforms external and CDN image URLs into compressed, WebP/AVIF edge-cached thumbnails.
 */

/**
 * Optimizes an avatar image URL for size, format, and edge CDN caching.
 * @param {string} url - Original image URL
 * @param {number} targetPx - Target square dimension in pixels (default: 160)
 * @returns {string} Optimized image URL
 */
export function optimizeAvatarUrl(url, targetPx = 160) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Data URLs, Blobs, or SVGs don't need resizing
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.endsWith('.svg') || trimmed.includes('dicebear.com')) {
    return trimmed;
  }

  // 1. Cloudinary CDN optimization
  if (trimmed.includes('res.cloudinary.com') && trimmed.includes('/upload/')) {
    // Avoid double transformation if already present
    if (!trimmed.includes('/upload/f_auto') && !trimmed.includes('/upload/c_')) {
      const transform = `f_auto,q_auto:good,w_${targetPx},h_${targetPx},c_fill,g_face`;
      return trimmed.replace('/upload/', `/upload/${transform}/`);
    }
    return trimmed;
  }

  // 2. Unsplash Image CDN optimization
  if (trimmed.includes('images.unsplash.com')) {
    try {
      const parsed = new URL(trimmed);
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('fit', 'crop');
      parsed.searchParams.set('q', '75');
      parsed.searchParams.set('w', String(targetPx));
      parsed.searchParams.set('h', String(targetPx));
      return parsed.toString();
    } catch (_) {
      if (trimmed.includes('?')) {
        return trimmed.replace(/\bw=\d+/, `w=${targetPx}`) + '&auto=format&fit=crop&q=75';
      }
      return `${trimmed}?auto=format&fit=crop&q=75&w=${targetPx}&h=${targetPx}`;
    }
  }

  // 3. Google User Content / Gravatar
  if (trimmed.includes('googleusercontent.com') && !trimmed.includes('=s')) {
    return `${trimmed}=s${targetPx}-c`;
  }

  return trimmed;
}

/**
 * Optimizes chat media preview images
 * @param {string} url - Original image URL
 * @param {number} maxDim - Maximum width/height dimension
 * @returns {string} Optimized preview URL
 */
export function optimizeChatMediaUrl(url, maxDim = 800) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.endsWith('.svg')) {
    return trimmed;
  }

  if (trimmed.includes('res.cloudinary.com') && trimmed.includes('/upload/')) {
    if (!trimmed.includes('/upload/f_auto') && !trimmed.includes('/upload/c_')) {
      return trimmed.replace('/upload/', `/upload/f_auto,q_auto:good,w_${maxDim},c_limit/`);
    }
  }

  if (trimmed.includes('images.unsplash.com')) {
    try {
      const parsed = new URL(trimmed);
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('q', '80');
      parsed.searchParams.set('w', String(maxDim));
      return parsed.toString();
    } catch (_) {
      return trimmed;
    }
  }

  return trimmed;
}
