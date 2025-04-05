const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const User = require("./models/user");
const Blog = require("./models/blog");
const cookieParser = require("cookie-parser");
// const { token } = require('morgan');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ credentials: true, origin: "http://localhost:5173" }));
app.use((err, req, res, next) => {
  console.error("Error in JSON parsing middleware:", err);
  res.status(400).json({ message: "Invalid JSON payload" });
});

app.use(cookieParser());

mongoose.connect(process.env.MONGO_URI);

app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  const salt = bcrypt.genSaltSync(10);
  console.log(username, email, password, salt);
  try {
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    res
      .status(201)
      .json({ message: "User created successfully", user: newUser });
  } catch (error) {
    console.error(error);
    // res.status(500).json({ error: error });
    if (error.code === 11000) {
      if (error.keyPattern.email) {
        res
          .status(400)
          .json({ value: "email", message: "Email already exists" });
      } else {
        res
          .status(400)
          .json({ value: "username", message: "Username already exists" });
      }
    }
  }
});

app.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    const userDoc = await User.findOne({ email });

    console.log("SIGN IN");
    // Check if user exists
    if (!userDoc) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Verfy password
    const isPasswordCorrect = bcrypt.compareSync(password, userDoc.password);
    if (isPasswordCorrect) {
      // res.json({message: 'Login successful'});

      try {
        const token = jwt.sign({ id: userDoc._id }, process.env.JWT_SECRET, {
          expiresIn: "1d",
        });
        res.cookie("token", token).json("ok");
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
      }

      // const token = jwt.sign({ id: userDoc._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

      // res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'Strict' });
      // res.json({ message: 'Login successful', token });
    } else {
      res.status(400).json({ message: "Invalid credentials" });
    }
  } catch (err) {
    console.log(err);
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, info) => {
    if (err) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(info);
    console.log("Profile", info);
  });
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

app.post("/publish", async (req, res) => {
  try {
    const title = req.body.title;
    const description = req.body.description;
    const tags = req.body.tags;
    const editor = req.body.editor;

    // Convert the content back to a JSON object
    const parsedEditor = JSON.parse(editor);

    // console.log("title, description, editor, tags: ",title, description, parsedEditor, tags);

    // Retrieve user ID
    const { token } = req.cookies;
    const userID = jwt.verify(token, process.env.JWT_SECRET, (err, info) => {
      if (err) {
        return res.status(403).json({ message: "Forbidden" });
      }
      return info.id;
    });

    // Create a new blog instance.
    const newBlog = new Blog({
      title,
      description,
      editor: parsedEditor,
      tags,
      createdBy: userID,
      editedBy: userID,
    });

    // // Save the blog to the database.
    const savedBlog = await newBlog.save();

    console.log("Blog saved successfully:", savedBlog);
    res.status(201).json({ message: "ok" });
  } catch (error) {
    console.error("Error creating blog:", error);
    res.status(500).json({ message: "Error creating blog", error });
  }
});

// endpoint to get all the blogs from database
app.get("/blogs", async (req, res) => {
  try {
    const blogs = await Blog.find().populate("createdBy", "username");
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Server running on ", process.env.PORT)
);
