import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import UserRoute from "./routes/users.js";
import ProductRoute from "./routes/products.js";


dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.log("MongoDB connection error:", err));

const app = express();
app.use(cors());
app.use(express.json());

// routes
app.use("/api/users", UserRoute);
app.use("/api/products", ProductRoute);

app.get("/", (req, res) => res.send("Back End Is Answer"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
