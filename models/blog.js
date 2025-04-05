const mongoose = require("mongoose");
const { model, Schema } = mongoose;

const blogSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    // Assuming TipTap's editor object is saved as JSON.
    editor: {
      type: Schema.Types.Mixed,
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    // Reference to the user who created the blog post.
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Initially, editedBy is the same as createdBy.
    editedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isEditing: {
      type: Boolean,
      default: false,
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = model("Blog", blogSchema);
