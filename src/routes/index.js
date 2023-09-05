// configure routes
const express = require("express");
const dotenv = require("dotenv");
const Openai = require("openai");
dotenv.config();
const router = express.Router();

const openai = new Openai({ apiKey: process.env.OPENAI_API_KEY });

router.post("/stream", async (req, res) => {
  const stream = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: "write a js code" }],
    stream: true,
  });

  for await (const part of stream) {
    if (part.choices[0].delta.content == undefined) {
      break;
    }
    // Stream the parts to the client
    res.write(part.choices[0].delta.content); // Write the content of the part to the response
  }

  res.end(); // End the response stream when all parts are sent
});

module.exports = router;
