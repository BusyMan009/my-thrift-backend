import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";
import "dotenv/config";
import cors from "cors";
import UserRoute from "./routes/users.js";
import ProductRoute from "./routes/products.js";
import CommentRoute from "./routes/Comment.js";
import AuthRoute from "./routes/auth.js";
import ChatRoute from "./routes/chat.js";

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  "MONGO_URI",
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "RESEND_API_KEY",
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingEnvVars.join(", ")
  );
  console.error(
    "Please check your .env file and ensure all required variables are set."
  );
  process.exit(1);
}

console.log("✅ All required environment variables are set");

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

const app = express();
const httpServer = createServer(app);

// Optimize Socket.io to reduce server load
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL
      ? [process.env.FRONTEND_URL]
      : ["http://localhost:5173"],
    methods: ["GET", "POST"],
  },
  // Performance optimizations
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
  // Reduce data size sent
  compression: true,
  // Set maximum connections limit (important for free server)
  maxHttpBufferSize: 1e6, // 1MB
});

app.use((req, res, next) => {
  const allowedOrigins = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL]
    : ["http://localhost:5173"];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, ngrok-skip-browser-warning"
  );

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

// Make io available in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// routes
app.use("/api/auth", AuthRoute);
app.use("/api/users", UserRoute);
app.use("/api/products", ProductRoute);
app.use("/api/comments", CommentRoute);
app.use("/api/chats", ChatRoute);

app.get("/", (req, res) => res.send("Back End Is Answer"));

// Health check route for Render
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Optimize WebSocket to limit resource consumption
const connectedUsers = new Map(); // Store connected users

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Clean old connections
  socket.on("join", (userId) => {
    // Disconnect old connection if exists
    if (connectedUsers.has(userId)) {
      const oldSocket = connectedUsers.get(userId);
      if (oldSocket && oldSocket.id !== socket.id) {
        oldSocket.disconnect();
      }
    }

    socket.userId = userId;
    connectedUsers.set(userId, socket);
    console.log(`User${userId}connected`);
  });

  // Join specific chat room
  socket.on("join_chat", (chatId) => {
    socket.join(chatId);
    console.log(`User joined chat${chatId}`);
  });

  // Leave chat room
  socket.on("leave_chat", (chatId) => {
    socket.leave(chatId);
    console.log(`User left chat ${chatId}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Clean saved data
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
    }
  });

  // Handle unexpected disconnection
  socket.on("error", (error) => {
    console.log("Socket error:", error);
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
    }
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
