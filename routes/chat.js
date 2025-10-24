import express from "express";
import Chat from "../models/Chat.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all chats for a user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const chats = await Chat.find({
      participants: userId,
    })
      .populate("participants", "name profileImage")
      .populate("lastMessage.sender", "name")
      .sort({ lastActivity: -1 });

    // Format chats for frontend
    const formattedChats = chats.map((chat) => {
      const otherUser = chat.participants.find(
        (p) => p._id.toString() !== userId.toString()
      );
      const unreadCount = chat.messages.filter(
        (m) => !m.isRead && m.sender.toString() !== userId.toString()
      ).length;

      return {
        _id: chat._id,
        otherUser,
        lastMessage: chat.lastMessage,
        lastActivity: chat.lastActivity,
        unreadCount,
      };
    });

    res.status(200).json(formattedChats);
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// Start or get chat with another user
router.post("/start", authenticateToken, async (req, res) => {
  try {
    const { otherUserId } = req.body;
    const currentUserId = req.user._id;

    if (!otherUserId) {
      return res.status(400).json({ error: "Other user ID is required" });
    }

    if (otherUserId === currentUserId.toString()) {
      return res.status(400).json({ error: "Cannot chat with yourself" });
    }

    // Check if chat already exists
    let chat = await Chat.findOne({
      participants: { $all: [currentUserId, otherUserId] },
    })
      .populate("participants", "name profileImage")
      .populate("messages.sender", "name profileImage");

    if (!chat) {
      // Create new chat
      chat = new Chat({
        participants: [currentUserId, otherUserId],
        messages: [],
      });

      await chat.save();

      // Populate the new chat
      await chat.populate("participants", "name profileImage");
    }

    res.status(200).json(chat);
  } catch (error) {
    console.error("Error starting chat:", error);
    res.status(500).json({ error: "Failed to start chat" });
  }
});

// Get chat by ID with messages
router.get("/:chatId", authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId)
      .populate("participants", "name profileImage")
      .populate("messages.sender", "name profileImage");

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Check if user is participant
    if (
      !chat.participants.some((p) => p._id.toString() === userId.toString())
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Mark messages as read for current user
    chat.messages.forEach((message) => {
      if (message.sender._id.toString() !== userId.toString()) {
        message.isRead = true;
      }
    });

    await chat.save();

    res.status(200).json(chat);
  } catch (error) {
    console.error("Error fetching chat:", error);
    res.status(500).json({ error: "Failed to fetch chat" });
  }
});

// ============= 2. UPDATE routes/chat.js - Add WebSocket to send message =============
// Just update the send message route:

// ============= routes/chat.js =============
router.post("/:chatId/message", authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Message content is required" });
    }

    const chat = await Chat.findById(chatId).populate(
      "participants",
      "name profileImage"
    );

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    if (
      !chat.participants.some((p) => p._id.toString() === userId.toString())
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    const newMessage = {
      sender: userId,
      content: content.trim(),
      timestamp: new Date(),
      isRead: false,
    };

    chat.messages.push(newMessage);
    chat.lastMessage = {
      content: content.trim(),
      sender: userId,
      timestamp: new Date(),
    };
    chat.lastActivity = new Date();

    await chat.save();

    // Fetch message with sender information
    const fullChat = await Chat.findById(chatId)
      .populate("participants", "name profileImage")
      .populate("messages.sender", "name profileImage");

    const populatedMessage = fullChat.messages[fullChat.messages.length - 1];

    // Send message to all chat participants (including sender)
    req.io.to(chatId).emit("new_message", {
      chatId,
      message: populatedMessage,
      lastMessage: {
        content: content.trim(),
        timestamp: newMessage.timestamp,
      },
      lastActivity: newMessage.timestamp,
    });

    // Send chat list update to all participants
    chat.participants.forEach((participant) => {
      req.io.emit("chat_list_update", {
        userId: participant._id.toString(),
        chatId,
        lastMessage: {
          content: content.trim(),
          timestamp: newMessage.timestamp,
        },
        lastActivity: newMessage.timestamp,
      });
    });

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Delete chat
router.delete("/:chatId", authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Check if user is participant
    if (
      !chat.participants.some((p) => p._id.toString() === userId.toString())
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    await Chat.findByIdAndDelete(chatId);

    res.status(200).json({ message: "Chat deleted successfully" });
  } catch (error) {
    console.error("Error deleting chat:", error);
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

// Get unread messages count
router.get("/unread/count", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const chats = await Chat.find({
      participants: userId,
    });

    let totalUnread = 0;
    chats.forEach((chat) => {
      const unreadCount = chat.messages.filter(
        (m) => !m.isRead && m.sender.toString() !== userId.toString()
      ).length;
      totalUnread += unreadCount;
    });

    res.status(200).json({ unreadCount: totalUnread });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

export default router;
