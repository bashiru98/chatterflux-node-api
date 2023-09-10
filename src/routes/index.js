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

  let contextualPrompt = "";
  // if there is no prompt in the request body send bad request
  if (!prompt) {
    res.status(400).json("Bad Request");
    return;
  }

  if (!chatId) return res.status(400).json("chatId is required");

  // get all messages for this chat
  const messages = await models.Message.find({ chatId });

  // if there are up to 3 messages in the chat concat them in descending order and add it to the the prompt
  if (messages.length > 0) {
    // take only last three messages
    const lastMessages = messages.slice(messages.length - 4);
    // for each message concat prompt and messsage
    lastMessages.forEach((message) => {
      contextualPrompt += " " + message.prompt + " " + message.message;
    });
  }

  const fullPrompt = contextualPrompt + " " + prompt;

  const stream = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: fullPrompt }],
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

// moderation
router.post("/moderate", async (req, res) => {
  try {
    const prompt = req?.body?.prompt;
    const endpoint = "https://api.openai.com/v1/moderations";

    if (!prompt) return res.status(400).json("prompt is required");

    // make a moderation request
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        input: prompt,
      }),
    };

    const response = await fetch(endpoint, requestOptions);

    if (!response.ok) {
      return res.status(400).json("error obtaining moderation response");
    }

    const data = await response.json();

    res.status(200).json({
      flagged: data?.results[0]?.flagged || false,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json("Internal Server Error");
  }
});

module.exports = router;
