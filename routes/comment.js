import express from "express";
import Comment from "../models/Comment.js";
import Product from "../models/Product.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// === GET All Comments for a Product === (Public)
router.get("/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    const comments = await Comment.find({ Product: productId })
      .populate("User", "name email profileImage")
      .populate("Product", "name")
      .sort({ createdAt: -1 });
    
    res.status(200).json(comments);
  } catch (err) {
    console.error("Error fetching comments:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// === POST Create Comment === (Protected - requires authentication)
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { text, ProductId } = req.body;
    const UserId = req.user._id; // Get user ID from authenticated token
    
    if (!text || !ProductId) {
      return res.status(400).json({ error: "Text and ProductId are required" });
    }
    
    // Check if product exists
    const product = await Product.findById(ProductId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    const newComment = new Comment({
      text,
      User: UserId,
      Product: ProductId
    });
    
    await newComment.save();
    
    // Update product with new comment
    await Product.findByIdAndUpdate(ProductId, {
      $inc: { commentCount: 1 },
      $push: { comments: newComment._id }
    });
    
    // Populate the comment before sending response
    const populatedComment = await Comment.findById(newComment._id)
      .populate("User", "name email profileImage")
      .populate("Product", "name");
    
    res.status(201).json(populatedComment);
    console.log("Comment added successfully");
  } catch (err) {
    console.error("Error adding comment:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// === PUT Update Comment === (Protected - only comment owner can update)
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    const commentId = req.params.id;
    
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }
    
    // Find the comment first to check ownership
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }
    
    // Check if the authenticated user is the owner of the comment
    if (comment.User.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied. You can only update your own comments." });
    }
    
    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      { $set: { text } },
      { new: true, runValidators: true }
    )
    .populate("User", "name email profileImage")
    .populate("Product", "name");
    
    res.status(200).json(updatedComment);
    console.log("Comment updated successfully");
  } catch (err) {
    console.error("Error updating comment:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// === DELETE Comment === (Protected - only comment owner can delete)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const commentId = req.params.id;
    
    // Find the comment first to check ownership
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }
    
    // Check if the authenticated user is the owner of the comment
    if (comment.User.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied. You can only delete your own comments." });
    }
    
    const productId = comment.Product;
    
    // Delete the comment
    await Comment.findByIdAndDelete(commentId);
    
    // Update product: remove comment from comments array and decrease comment count
    await Product.findByIdAndUpdate(productId, {
      $inc: { commentCount: -1 },
      $pull: { comments: commentId }
    });
    
    res.status(200).json({ message: "Comment deleted successfully" });
    console.log("Comment deleted successfully");
  } catch (err) {
    console.error("Error deleting comment:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// === GET User's Comments === (Protected - user can get their own comments)
router.get("/user/my-comments", authenticateToken, async (req, res) => {
  try {
    const comments = await Comment.find({ User: req.user._id })
      .populate("User", "name email profileImage")
      .populate("Product", "name images")
      .sort({ createdAt: -1 });
    
    res.status(200).json(comments);
    console.log("User comments fetched successfully");
  } catch (err) {
    console.error("Error fetching user comments:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// === GET Single Comment === (Public)
router.get("/:id", async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id)
      .populate("User", "name email profileImage")
      .populate("Product", "name");
    
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }
    
    res.status(200).json(comment);
  } catch (err) {
    console.error("Error fetching comment:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;