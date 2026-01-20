/**
 * Compress and resize image for profile pictures
 * @param {File} file - The image file to compress
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Maximum width in pixels (default: 300)
 * @param {number} options.maxHeight - Maximum height in pixels (default: 300)
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.8)
 * @param {number} options.maxSizeKB - Maximum file size in KB (default: 100)
 * @returns {Promise<string>} - Promise that resolves to base64 data URL
 */
export function compressImage(file, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      maxWidth = 300,
      maxHeight = 300,
      quality = 0.8,
      maxSizeKB = 100
    } = options;

    // Check if file is an image
    if (!file.type.match('image.*')) {
      reject(new Error('File is not an image'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Draw image on canvas with high quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Determine output format
        // Use JPEG for photos (smaller), PNG only if original was PNG with transparency
        let outputFormat = 'image/jpeg';
        let outputQuality = quality;
        
        // Check if original is PNG (might have transparency)
        if (file.type === 'image/png') {
          // Check if image has transparency by reading pixel data
          const imageData = ctx.getImageData(0, 0, width, height);
          let hasTransparency = false;
          
          for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] < 255) {
              hasTransparency = true;
              break;
            }
          }
          
          if (hasTransparency) {
            outputFormat = 'image/png';
            outputQuality = undefined; // PNG doesn't use quality parameter
          }
        }

        // Convert to base64
        let dataURL = canvas.toDataURL(outputFormat, outputQuality);

        // If still too large, progressively reduce quality until under maxSizeKB
        if (outputFormat === 'image/jpeg') {
          let currentQuality = quality;
          let attempts = 0;
          const maxAttempts = 10;
          
          while (attempts < maxAttempts) {
            const sizeInKB = (dataURL.length * 0.75) / 1024; // Base64 is ~33% larger
            
            if (sizeInKB <= maxSizeKB) {
              break;
            }
            
            // Reduce quality by 0.1 each attempt
            currentQuality = Math.max(0.1, currentQuality - 0.1);
            dataURL = canvas.toDataURL(outputFormat, currentQuality);
            attempts++;
          }
        }

        // Log compression stats
        const originalSizeKB = (file.size / 1024).toFixed(2);
        const compressedSizeKB = ((dataURL.length * 0.75) / 1024).toFixed(2);
        const compressionRatio = ((1 - (dataURL.length * 0.75) / file.size) * 100).toFixed(1);
        
        console.log(`[Image Compression] Original: ${originalSizeKB}KB → Compressed: ${compressedSizeKB}KB (${compressionRatio}% reduction)`);
        console.log(`[Image Compression] Dimensions: ${img.width}x${img.height} → ${width}x${height}`);

        resolve(dataURL);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

