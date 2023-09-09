// configure routes
const express = require("express");
const mongoose = require("mongoose");
const models = require("../model");
const dotenv = require("dotenv");
const Openai = require("openai");
dotenv.config();
const router = express.Router();

const openai = new Openai({ apiKey: process.env.OPENAI_API_KEY });

router.post("/stream", async (req, res) => {
  // get the email of the user making the request
  const user = req.query?.user;
  const prompt = req.query?.prompt;
  const chatId = req?.query?.chatId;
  //  if there is no  user in the request body forbid the request
  if (!user) {
    res.status(403).json("Forbidden");
    return;
  }

  // if there is no prompt in the request body send bad request
  if (!prompt) {
    res.status(400).json("Bad Request");
    return;
  }

  if (!chatId) return res.status(400).json("chatId is required");

  const stream = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  let messageAcc = "";
  for await (const part of stream) {
    if (part.choices[0].delta.content == undefined) {
      break;
    }

    messageAcc += part.choices[0].delta.content;
    // Stream the parts to the client
    res.write(part.choices[0].delta.content); // Write the content of the part to the response
  }

  // at this point the stream is finished
  // save the message to the database
  const message = new models.Message({
    user,
    message: messageAcc,
    // date should be in milliseconds
    time: req?.body?.time || Date.now(),
    prompt,
    chatId,
  });

  await message.save();
  // end request early and continue with other logics
  res.end(); // End the response stream when all parts are sent
  // check if there first message in the chat
  const chat = await models.Chat.findById(chatId);

  if (chat) {
    // first check if there first message in the chat
    const firstMessage = chat?.firstMessage;
    if (!firstMessage) {
      const firstMessage = chat?.firstMessage;
      if (!firstMessage) {
        // if there is no first message in the chat update the message
        // first summarize the prompt using gpt and update the message
        const summarizePromptResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "user",
              content:
                "summarize" +
                " " +
                messageAcc +
                " " +
                " into a nice short title that is relevant to the content" +
                " " +
                prompt,
            },
          ],
          stream: false,
        });
        const firstMessage =
          summarizePromptResponse?.choices[0]?.message?.content;

        // update the chat with the first message
        await models.Chat.findByIdAndUpdate(chatId, {
          firstMessage,
        });
      }
    }
  }
});

// get all chats for a specific user
router.get("/chats", async (req, res) => {
  try {
    const user = req.query?.user;

    const chats = await models.Chat.find({ user });

    res.json(chats);
  } catch (error) {
    console.error(error);
    res.status(500).json("Internal Server Error");
  }
});

// get all messages for a specific chat
router.get("/messages", async (req, res) => {
  try {
    const chatId = req.query?.chatId;

    const messages = await models.Message.find({ chatId });

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// create a new chat
router.post("/chats", async (req, res) => {
  try {
    const user = req.body?.user;
    const firstMessage = req.body?.firstMessage;

    if (!user) {
      res.status(400).json("Bad Request");
      return;
    }

    const newChat = new models.Chat({
      user,
      firstMessage,
      time: req?.body?.time || Date.now(),
    });

    await newChat.save();

    res.json(newChat);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// delete a chat
router.delete("/chats/:id", async (req, res) => {
  try {
    const id = req.params?.id;

    const deleteChat = await models.Chat.findByIdAndDelete(
      new mongoose.Types.ObjectId(id)
    );

    if (!deleteChat) return res.status(400).json("Failed to delete chat");

    // delete all messages for this chat
    await models.Message.deleteMany({ chatId: id });

    res.json(deleteChat);
  } catch (error) {
    console.log(error);
    res.status(500).json("Internal Server Error");
  }
});

module.exports = router;
