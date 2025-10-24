import express from "express";
import Product from "../models/Product.js";
import cloudinary from "../config/cloudinary.js";
import multer from "multer";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// === GET All Products === (Public - now with pagination support)
router.get("/", async (req, res) => {
  try {
    // Extract pagination parameters (optional - if not provided, works as before)
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    const search = req.query.search;
    const category = req.query.category;
    const location = req.query.location;
    const minPrice = parseFloat(req.query.minPrice);
    const maxPrice = parseFloat(req.query.maxPrice);
    const sortBy = req.query.sortBy; // newest, oldest, price_low, price_high, popular

    // Create search filter
    let filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (category && category !== "All") {
      filter.category = category;
    }

    if (location && location !== "All") {
      filter.location = location;
    }

    if (minPrice && !isNaN(minPrice)) {
      filter.price = { ...filter.price, $gte: minPrice };
    }

    if (maxPrice && !isNaN(maxPrice)) {
      filter.price = { ...filter.price, $lte: maxPrice };
    }

    // Create sort object
    let sort = { createdAt: -1 }; // default: newest first

    switch (sortBy) {
      case "newest":
        sort = { createdAt: -1 };
        break;
      case "oldest":
        sort = { createdAt: 1 };
        break;
      case "price_low":
        sort = { price: 1 };
        break;
      case "price_high":
        sort = { price: -1 };
        break;
      case "popular":
        sort = { views: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    // If pagination parameters not provided, use old method
    if (!page || !limit) {
      const products = await Product.find(filter)
        .populate("user", "name email profileImage")
        .populate({
          path: "comments",
          populate: { path: "User", select: "name email profileImage" },
        })
        .sort(sort);

      res.status(200).json(products);
      console.log("GET ALL PRODUCTS DONE (without pagination)");
      return;
    }

    // Pagination logic
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const [products, totalCount] = await Promise.all([
      Product.find(filter)
        .populate("user", "name email profileImage")
        .populate({
          path: "comments",
          populate: { path: "User", select: "name email profileImage" },
        })
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    // Send result with pagination info
    res.status(200).json({
      data: products,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext,
        hasPrev,
        limit,
      },
      filters: {
        search,
        category,
        location,
        minPrice,
        maxPrice,
        sortBy,
      },
    });

    console.log(
      `GET ALL PRODUCTS DONE with pagination - Page ${page}/${totalPages}`
    );
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// === GET Single Product === (Public - with views)
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("user", "name email profileImage")
      .populate({
        path: "comments",
        populate: { path: "User", select: "name email profileImage" },
      });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Increment views by 1
    await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

    // Return product with updated view count
    const updatedProduct = await Product.findById(req.params.id)
      .populate("user", "name email profileImage")
      .populate({
        path: "comments",
        populate: { path: "User", select: "name email profileImage" },
      });

    res.status(200).json(updatedProduct);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// === PUT Increment Views Only === (Public - for increasing views only)
router.put("/:id/view", async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    ).select("views");

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.status(200).json({ views: product.views });
  } catch (err) {
    console.error("Error updating views:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// === POST Create Product === (Protected - with phone number)
router.post(
  "/",
  authenticateToken,
  upload.array("images", 10),
  async (req, res) => {
    const {
      name,
      description,
      price,
      condition,
      category,
      location,
      phoneNumber,
    } = req.body;
    const files = req.files;

    // Use authenticated user's ID instead of getting it from request body
    const userId = req.user._id;

    if (
      !name ||
      !price ||
      !location ||
      !phoneNumber ||
      !files ||
      files.length === 0
    ) {
      return res.status(400).json({
        error: "Name, price, location, phone number, and images are required.",
      });
    }

    try {
      const uploadedImageUrls = [];

      for (const file of files) {
        const b64 = Buffer.from(file.buffer).toString("base64");
        let dataURI = "data:" + file.mimetype + ";base64," + b64;

        const uploadedResponse = await cloudinary.uploader.upload(dataURI, {
          folder: "MyThrift",
        });
        uploadedImageUrls.push(uploadedResponse.secure_url);
      }

      console.log("Images uploaded successfully");

      const newProduct = new Product({
        name,
        description,
        images: uploadedImageUrls,
        price,
        condition,
        category,
        location,
        phoneNumber,
        user: userId, // Use authenticated user's ID
      });

      const savedProduct = await newProduct.save();

      // Populate user data before sending response
      const populatedProduct = await Product.findById(
        savedProduct._id
      ).populate("user", "name email profileImage");

      res.status(201).json(populatedProduct);
      console.log("Product created successfully");
    } catch (err) {
      console.error("Error saving product:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// === PUT Update Product === (Protected - updated to handle images)
router.put(
  "/:id",
  authenticateToken,
  upload.array("images", 10),
  async (req, res) => {
    try {
      console.log("PUT request received for product:", req.params.id);
      console.log("Request body:", req.body);
      console.log("Files received:", req.files?.length || 0);

      // Find the product first to check ownership
      const product = await Product.findById(req.params.id);

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Check if the authenticated user is the owner of the product
      if (product.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          error: "Access denied. You can only update your own products.",
        });
      }

      // Extract update data (exclude user, comments, etc.)
      const { user, comments, commentCount, existingImages, ...updateData } =
        req.body;

      // Handle images update
      let finalImages = [];

      // 1. Add existing images that weren't removed
      if (existingImages) {
        if (Array.isArray(existingImages)) {
          finalImages = [...existingImages];
        } else if (typeof existingImages === "string") {
          // Handle single existing image
          finalImages = [existingImages];
        }
      }

      // 2. Upload new images if any
      if (req.files && req.files.length > 0) {
        console.log("Uploading new images...");

        for (const file of req.files) {
          try {
            const b64 = Buffer.from(file.buffer).toString("base64");
            let dataURI = "data:" + file.mimetype + ";base64," + b64;

            const uploadedResponse = await cloudinary.uploader.upload(dataURI, {
              folder: "MyThrift",
            });

            finalImages.push(uploadedResponse.secure_url);
            console.log("Image uploaded successfully");
          } catch (uploadError) {
            console.error("Error uploading image:", uploadError);
            // Continue with other images if one fails
          }
        }
      }

      // 3. Ensure we have at least one image
      if (finalImages.length === 0) {
        return res
          .status(400)
          .json({ error: "At least one image is required" });
      }

      // 4. Limit to maximum 5 images
      if (finalImages.length > 5) {
        finalImages = finalImages.slice(0, 5);
      }

      // Add the processed images to update data
      updateData.images = finalImages;

      console.log("Final images count:", finalImages.length);
      console.log("Update data:", {
        ...updateData,
        images: "[" + finalImages.length + " images]",
      });

      // Update the product
      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true, runValidators: true }
      )
        .populate("user", "name email profileImage")
        .populate({
          path: "comments",
          populate: { path: "User", select: "name email profileImage" },
        });

      if (!updatedProduct) {
        return res
          .status(404)
          .json({ error: "Product not found after update" });
      }

      res.status(200).json(updatedProduct);
      console.log("Product updated successfully");
    } catch (err) {
      console.error("Error updating product:", err);
      res.status(500).json({ error: "Internal Server Error: " + err.message });
    }
  }
);

// === DELETE Product === (Protected - لا تغيير)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    // Find the product first to check ownership
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check if the authenticated user is the owner of the product
    if (product.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: "Access denied. You can only delete your own products.",
      });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Product deleted successfully" });
    console.log("Product deleted successfully");
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// === GET User's Products === (Protected - with optional pagination)
router.get("/user/my-products", authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);

    // If pagination not provided, use old method
    if (!page || !limit) {
      const products = await Product.find({ user: req.user._id })
        .populate("user", "name email profileImage")
        .populate({
          path: "comments",
          populate: { path: "User", select: "name email profileImage" },
        })
        .sort({ createdAt: -1 });

      res.status(200).json(products);
      console.log("User products fetched successfully (without pagination)");
      return;
    }

    const skip = (page - 1) * limit;
    const filter = { user: req.user._id };

    const [products, totalCount] = await Promise.all([
      Product.find(filter)
        .populate("user", "name email profileImage")
        .populate({
          path: "comments",
          populate: { path: "User", select: "name email profileImage" },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      data: products,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit,
      },
    });

    console.log(
      `User products fetched successfully with pagination - Page ${page}/${totalPages}`
    );
  } catch (err) {
    console.error("Error fetching user products:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET Categories with counts
router.get("/meta/categories", async (req, res) => {
  try {
    const categories = await Product.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET Locations with counts
router.get("/meta/locations", async (req, res) => {
  try {
    const locations = await Product.aggregate([
      { $group: { _id: "$location", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json(locations);
  } catch (err) {
    console.error("Error fetching locations:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
