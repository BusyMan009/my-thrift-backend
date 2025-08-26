import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Product from "../models/Product.js";
const router = express.Router();



router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password'); 
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.post("/add", async (req, res) => {
    const { name, email, password, profileImage, location, favorites } = req.body;
    console.log(name, email, password, profileImage, location, favorites)
    if (!name || !email || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            profileImage,
            location,
            favorites
        });

        const savedUser = await newUser.save();
        res.status(201).json(savedUser);
        console.log("THE DATA BEEN SAVE SUCEESCC :)")

    }  catch (err) {
        console.error("Error saving user:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


router.get("/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const products = await Product.find({ user: userId });

    res.status(200).json({ user, products });
    console.log("GET ALL POSTS IS DOME ")
  } catch (err) {
    console.error("Error fetching user:", err); 
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: req.body,
      },
      { new: true, runValidators: true }
    ).select('-password'); // نخفي الباسورد من الرد

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(updatedUser);
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.delete('/:id', async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET ALL POST 
router.get("/user/:id", async (req, res) => {
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
// GET ALL POST 


export default router;
