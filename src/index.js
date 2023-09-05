const dotenv = require("dotenv");
const mongoose = require("mongoose");
const router = require("./routes");
dotenv.config();

const express = require("express");

const start = async () => {
  const app = express();

  app.use(express.json());
  // enable CORS and allow localhost 3000 access
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "http://localhost:3000"); // update to match the domain you will make the request from
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS, PUT, PATCH, DELETE"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
  });
  // configure routes
  app.use("/", router);
  // connect to mongo using mongoose
  mongoose.connect(process.env.MONGOURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const db = mongoose.connection;

  db.on("error", (error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  });

  db.once("open", () => {
    console.log("Connected to MongoDB");
  });
  // get port from environment
  const port = process.env.PORT || 4000;

  app.listen(port, () => console.log(`Listening on port ${port}`));
};

start().catch(() => console.log("Error starting server"));
