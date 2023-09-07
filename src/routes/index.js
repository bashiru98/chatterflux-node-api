// configure routes
const express = require("express");
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

  //  if there is no  user in the request body forbid the request
  if (!user) {
    res.status(403).send("Forbidden");
    return;
  }

  // if there is no prompt in the request body send bad request
  if (!prompt) {
    res.status(400).send("Bad Request");
    return;
  }

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
  });

  await message.save();
  // end request early and continue with other logics
  res.end(); // End the response stream when all parts are sent
  // check if there first message in the chat
  const chat = await models.Chat.findOne({ user });

  if (chat) {
    // first check if there first message in the chat
    const firstMessage = chat?.firstMessage;
    if (!firstMessage) {
      // if there is no first message in the chat update the message
      // first summarize the prompt using gpt and update the message
      // check if there first message in the chat
      const chat = await models.Chat.findOne({ user });

      if (chat) {
        // first check if there first message in the chat
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
                  "summarize" + " " + prompt + " " + " into a nice short title",
              },
            ],
            stream: false,
          });

          const firstMessage =
            summarizePromptResponse?.choices[0]?.message?.content;
          chat.firstMessage = firstMessage;
          await chat.save();
        }
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
    res.status(500).send("Internal Server Error");
  }
});

// get all messages for a specific chat
router.get("/messages/:user", async (req, res) => {
  try {
    const user = req.params?.user;

    const messages = await models.Message.find({ user });

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
    const firstMessage = req.body?.firstMessage || "";

    if (!user || !firstMessage) {
      res.status(400).send("Bad Request");
      return;
    }

    const newChat = new models.Chat({
      user,
      firstMessage,
      time: req?.body?.time || Date.now(),
    });

    await newChat.save();

    res.json(chat);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// delete a chat
router.delete("/chats/:id", async (req, res) => {
  try {
    const id = req.params?.id;

    const deleteChat = await models.Chat.findByIdAndDelete(id);

    res.json(deleteChat);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
