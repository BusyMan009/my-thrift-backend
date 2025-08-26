import express from "express";
import Product from "../models/Product.js";
import cloudinary from "../config/cloudinary.js";
import multer from "multer"; 

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// === GET All Products ===
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().populate("user", "name email profileImage");
    res.status(200).json(products);
    console.log("GET ITEM DONE ");
  } catch {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Internal Server Error" });
    console.log("GET ITEM BAD REQ");
  }
});
// === END GET All Products ===


// === POST Create Product ===
router.post("/", upload.array("images", 10), async (req, res) => {
  const { name, description, price, condition, category, location, user } = req.body;
  const files = req.files;

  if (!name || !price || !location || !files || files.length === 0 || !user) {
    return res.status(400).json({ error: "Name, price, location, and images are required." });
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

    console.log("Done UploadImage ");

    const newProduct = new Product({
      name,
      description,
      images: uploadedImageUrls,
      price,
      condition,
      category,
      location,
      user,
    });

    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (err) {
    console.error("Error saving product:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// === END POST Create Product ===


// === PUT Update Product ===
router.put("/:id", async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    console.log("PUT IS DONE ");
    res.status(200).json(updatedProduct);
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});
// === END PUT Update Product ===


// === DELETE Product ===
router.delete("/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    console.log("DELET IS DONE");
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});
// === END DELETE Product ===

export default router;
