import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Product from "../models/Product.js";
import { authenticateToken, authorizeUser } from "../middleware/authMiddleware.js";
import cloudinary from "../config/cloudinary.js";
import multer from "multer";


const router = express.Router();


// Upload Profile Img 
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'), false);
    }
  }
});
// Upload Profile Img 


// Get current user profile (protected)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get user by ID with their products (protected)
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const products = await Product.find({ user: userId });

    res.status(200).json({ user, products });
    console.log("GET ALL POSTS IS DONE");
  } catch (err) {
    console.error("Error fetching user:", err); 
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update user profile (protected)
router.put("/profile", authenticateToken, upload.single("profileImage"), async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Fields allowed for editing only (whitelist)
    const allowedFields = ['name', 'email', 'phone', 'location', 'bio'];
    const updateData = {};
    
    // Filter sent data to allow only specified fields
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    // Basic validation
    if (updateData.email && !isValidEmail(updateData.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    if (updateData.phone && !isValidPhone(updateData.phone)) {
      return res.status(400).json({ error: 'Invalid phone format (should be 05xxxxxxxx)' });
    }
    
    // Handle image upload
    if (req.file) {
      console.log("Uploading image to cloudinary...");
      
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ 
          error: 'Invalid file type. Only JPEG, PNG, and JPG are allowed.' 
        });
      }
      
      // Check file size (5MB max)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ 
          error: 'File size too large. Maximum size is 5MB.' 
        });
      }
      
      try {
        // Delete old image if exists
        const currentUser = await User.findById(userId);
        if (currentUser.profileImage && currentUser.profileImage.includes('cloudinary')) {
          const publicId = extractPublicIdFromUrl(currentUser.profileImage);
          await cloudinary.uploader.destroy(publicId);
        }
        
        // Upload new image
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              folder: 'user-profiles',
              width: 500,
              height: 500,
              crop: 'fill',
              quality: 'auto',
              format: 'jpg'
            },
            (error, result) => {
              if (error) {
                console.error("Cloudinary error:", error);
                reject(new Error('Failed to upload image'));
              } else {
                console.log("Image uploaded successfully:", result.secure_url);
                resolve(result);
              }
            }
          ).end(req.file.buffer);
        });
        
        updateData.profileImage = result.secure_url;
        
      } catch (imageError) {
        console.error("Image upload error:", imageError);
        return res.status(500).json({ 
          error: 'Failed to upload image. Please try again.' 
        });
      }
    }
    
    // Update user data
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { 
        new: true,
        runValidators: true
      }
    ).select('-password -__v');
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return updated data
    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
    
  } catch (err) {
    console.error("Error updating profile:", err);
    
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors 
      });
    }
    
    // Handle duplicate key error (duplicate email)
    if (err.code === 11000) {
      return res.status(400).json({ 
        error: 'Email already exists' 
      });
    }
    
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Helper functions
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone) {
  const phoneRegex = /^05[0-9]{8}$/;
  return phoneRegex.test(phone);
}

function extractPublicIdFromUrl(url) {
  // Extract public_id from cloudinary URL to delete old image
  const parts = url.split('/');
  const filename = parts[parts.length - 1];
  return `user-profiles/${filename.split('.')[0]}`;
}

// Delete user account (protected)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Also delete user's products
    await Product.deleteMany({ user: req.params.id });
    
    res.status(200).json({ message: 'User and associated products deleted successfully' });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get user's posts (protected) - user can only see their own posts
router.get("/:id/posts", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ error: "User not found" });

    const posts = await Product.find({ user: userId });

    res.status(200).json({ user, posts });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
}); 

// Add product to favorites (protected)
router.put("/products/:id/favorites/add", authenticateToken, async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ error: "ProductId is required" });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { favorites: productId } }, // يمنع التكرار
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json(user);
    console.log("Product added to favorites");
  } catch (err) {
    console.error("Error adding to favorites:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Remove product from favorites (protected)
router.put("/:id/favorites/remove", authenticateToken, async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ error: "ProductId is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $pull: { favorites: productId } },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json(user);
    console.log("Product removed from favorites");
  } catch (err) {
    console.error("Error removing from favorites:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get user favorites with product details (protected)
router.get("/:id/favorites", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    console.log('Fetching favorites for user:', userId);
    
    // Find user and populate favorites with more fields
    const user = await User.findById(userId)
      .populate({
        path: 'favorites',
        select: 'title name productTitle productName price images image imageUrl description user category createdAt',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .select('-password');
    
    if (!user) {
      console.log('User not found:', userId);
      return res.status(404).json({ error: "User not found" });
    }

    console.log('User found:', user.name);
    console.log('Raw favorites:', user.favorites);
    console.log('Favorites count:', user.favorites?.length || 0);

    // Filter out null/undefined favorites and ensure they have required fields
    const validFavorites = (user.favorites || []).filter(fav => {
      if (!fav) {
        console.log('Found null/undefined favorite, filtering out');
        return false;
      }
      
      if (!fav._id) {
        console.log('Found favorite without _id, filtering out:', fav);
        return false;
      }
      
      console.log('Valid favorite found:', {
        id: fav._id,
        title: fav.title || fav.name || 'No title',
        price: fav.price || 0
      });
      
      return true;
    });

    console.log('Valid favorites count:', validFavorites.length);

    // Ensure each favorite has a title field (fallback to name)
    const processedFavorites = validFavorites.map(fav => {
      // Try all possible fields for title
      let title = fav.title || 
                  fav.name || 
                  fav.productTitle || 
                  fav.productName || 
                  fav.itemName ||
                  fav.displayName ||
                  'Product';
      
      console.log('Processing favorite - Original:', {
        _id: fav._id,
        title: fav.title,
        name: fav.name,
        productTitle: fav.productTitle,
        allKeys: Object.keys(fav.toObject ? fav.toObject() : fav)
      });
      
      console.log('Final title chosen:', title);
      
      const processed = {
        _id: fav._id,
        title: title, // Make sure title exists
        name: title,  // Add name as backup
        productTitle: title, // Add productTitle as backup
        price: fav.price || 0,
        images: fav.images || (fav.image ? [fav.image] : []) || (fav.imageUrl ? [fav.imageUrl] : []),
        description: fav.description || 'No description available',
        category: fav.category || '',
        createdAt: fav.createdAt || new Date(),
        user: fav.user || null
      };
      
      console.log('Final processed favorite:', processed);
      return processed;
    });

    console.log('Final response favorites count:', processedFavorites.length);

    res.status(200).json({ 
      favorites: processedFavorites,
      count: processedFavorites.length,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email
      }
    });
    
  } catch (err) {
    console.error("Error fetching favorites:", err);
    res.status(500).json({ 
      error: "Internal Server Error",
      details: err.message 
    });
  }
});


// Change password (protected)
router.put("/:id/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await User.findByIdAndUpdate(req.params.id, { password: hashedNewPassword });

    res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Error changing password:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;