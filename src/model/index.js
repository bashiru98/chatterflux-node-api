const mongoose = require("mongoose");

// Define a schema for the User model
const chatSchema = new mongoose.Schema({
  user: String,
  //  time is in milliseconds
  time: Number,
  //   the first message sent for this chat
  firstMessage: String,
});

// Create a model from the chat schema
const Chat = mongoose.model("Chat", chatSchema);

// message schema
const messageSchema = new mongoose.Schema({
  chatId: String,
  user: String,
  message: String,
  prompt: String,
  time: Number,
});

// create a model from the message schema
const Message = mongoose.model("Message", messageSchema);

module.exports = { Chat, Message };
