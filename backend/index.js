import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import jwt from "jsonwebtoken";

import authRoutes from "./routes/auth.js";
import roomRoutes from "./routes/rooms.js";
import Chat from "./models/Chat.js";
import Room from "./models/Room.js";

dotenv.config();
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);

// ✅ Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ✅ JWT check for sockets
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    socket.user = { username: "Anonymous", id: null };
    return next();
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { username: payload.username, id: payload.id };
    return next();
  } catch {
    socket.user = { username: "Anonymous", id: null };
    return next();
  }
});

// ✅ Track users in rooms
const roomsUsers = {}; // { roomName: { socketId: { name, isOwner, canDraw } } }

io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id, "user:", socket.user?.username);

  // Join room
  socket.on("joinRoom", async (roomName) => {
    socket.join(roomName);
    roomsUsers[roomName] = roomsUsers[roomName] || {};

    // Check if room exists in DB
    let roomDoc = await Room.findOne({ name: roomName });
    if (!roomDoc) {
      // If not exists, create and make this user owner
      roomDoc = new Room({ name: roomName, owner: socket.user?.id });
      await roomDoc.save();
      console.log(`🏠 Room created: ${roomName} by ${socket.user?.username}`);
    }

    const isOwner = roomDoc.owner?.toString() === socket.user?.id;
    roomsUsers[roomName][socket.id] = {
      name: socket.user?.username || "Anonymous",
      isOwner,
      canDraw: isOwner, // owner can draw by default
    };

    console.log(`👥 ${socket.user?.username} joined room: ${roomName}`);

    // Send updated users list
    io.to(roomName).emit("onlineUsers", Object.values(roomsUsers[roomName]));

    // Send previous chat history
    try {
      const msgs = await Chat.find({ roomId: roomName })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean();
      socket.emit("loadMessages", msgs);
    } catch (err) {
      console.error("❌ Load messages failed:", err);
    }
  });

  // Leave room
  socket.on("leaveRoom", (roomName) => {
    socket.leave(roomName);
    if (roomsUsers[roomName]) {
      delete roomsUsers[roomName][socket.id];
      io.to(roomName).emit("onlineUsers", Object.values(roomsUsers[roomName]));
    }
  });

  // Chat
  socket.on("sendMessage", async (data) => {
    try {
      const roomId = data.roomId || "global";
      const chatDoc = new Chat({
        sender: socket.user?.username || "Anonymous",
        message: data.text,
        roomId,
      });
      await chatDoc.save();
      io.to(roomId).emit("receiveMessage", chatDoc);
    } catch (err) {
      console.error("❌ Error saving chat:", err);
    }
  });

  // Request draw permission
  socket.on("requestDraw", (roomId) => {
    const user = roomsUsers[roomId]?.[socket.id];
    if (!user) return;
    const ownerEntry = Object.entries(roomsUsers[roomId]).find(([_, u]) => u.isOwner);
    if (ownerEntry) {
      const [ownerSocketId] = ownerEntry;
      io.to(ownerSocketId).emit("drawRequest", {
        requesterId: socket.id,
        requesterName: user.name,
      });
    }
  });

  // Owner grants draw
  socket.on("grantDraw", ({ roomId, requesterId }) => {
    if (roomsUsers[roomId]?.[requesterId]) {
      roomsUsers[roomId][requesterId].canDraw = true;
      io.to(requesterId).emit("drawGranted");
      io.to(roomId).emit("onlineUsers", Object.values(roomsUsers[roomId]));
    }
  });

  // Owner denies draw
  socket.on("denyDraw", ({ roomId, requesterId }) => {
    if (roomsUsers[roomId]?.[requesterId]) {
      io.to(requesterId).emit("drawDenied");
    }
  });

 // Drawing
socket.on("draw", (data) => {
  const user = roomsUsers[data.roomId]?.[socket.id];
  if (!user) return;

  // Owner can always draw
  if (user.isOwner || user.canDraw) {
    io.to(data.roomId).emit("draw", data); // broadcast to ALL, including owner
  }
});

// Clear board
socket.on("clear", (data) => {
  const user = roomsUsers[data.roomId]?.[socket.id];
  if (!user) return;

  if (user.isOwner || user.canDraw) {
    io.to(data.roomId).emit("clear", data);
  }
});


  // Disconnect
  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);
    for (const roomId of Object.keys(roomsUsers)) {
      if (roomsUsers[roomId]?.[socket.id]) {
        delete roomsUsers[roomId][socket.id];
        io.to(roomId).emit("onlineUsers", Object.values(roomsUsers[roomId]));
      }
    }
  });
});

// ✅ MongoDB connect & start server
const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
    server.listen(process.env.PORT || 5000, () => {
      console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
    });
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
  }
};

start();
