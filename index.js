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
const History = require("./models/history");
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
    const blogs = await Blog.find()
      .populate("createdBy", "username")
      .sort({ updatedAt: -1 }); // Sort by updatedAt in descending order
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// endpoint to get a single blog by ID
app.get("/blog/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const blog = await Blog.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true, timestamps: false } // Disable timestamps for this operation
    )
      .populate("createdBy", "username")
      .populate("editedBy", "username");
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Retrieve user ID
    const { token } = req.cookies;
    const userID = jwt.verify(token, process.env.JWT_SECRET, (err, info) => {
      if (err) {
        return res.status(403).json({ message: "Forbidden" });
      }
      return info.id;
    });

    // Create history record for view
    await History.create({
      blog: id,
      user: userID,
      action: "view",
    });

    res.json(blog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/edit/:id", async (req, res) => {
  const { id } = req.params;
  console.log("Edit ID:", id);
  try {
    const blog = await Blog.findByIdAndUpdate(
      id,
      { isEditing: true },
      { new: true, timestamps: false } // Disable timestamps for this operation
    );
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }
    res.json(blog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/publishEdit/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, tags, editor } = req.body;

  console.log("Publish Edit ID:", id);
  // Convert the content back to a JSON object
  const parsedEditor = JSON.parse(editor);

  // Retrieve user ID
  const { token } = req.cookies;
  const userID = jwt.verify(token, process.env.JWT_SECRET, (err, info) => {
    if (err) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return info.id;
  });

  try {
    const updatedBlog = await Blog.findByIdAndUpdate(
      id,
      {
        title,
        description,
        tags,
        editor: parsedEditor,
        editedBy: userID,
        isEditing: false, // Set isEditing to false after editing
      },
      { new: true }
    );

    if (!updatedBlog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Create history record for edit
    await History.create({
      blog: id,
      user: userID,
      action: "edit",
    });

    res.json(updatedBlog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/editCleanup/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const updateBlog = await Blog.findByIdAndUpdate(
      id,
      { isEditing: false },
      { new: true, timestamps: false } // Disable timestamps for this operation
    );
    if (!updateBlog) {
      return res.status(404).json({ message: "Blog not found" });
    }
    res.json(updateBlog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/history/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const history = await History.find({ blog: id })
      .populate("user", "username")
      .populate("blog", "title")
      .sort({ createdAt: -1 }); // Sort by createdAt in descending order
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Server running on ", process.env.PORT)
);
