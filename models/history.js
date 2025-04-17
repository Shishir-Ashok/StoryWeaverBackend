const mongoose = require("mongoose");
const { model, Schema } = mongoose;

const historySchema = new Schema(
  {
    blog: {
      type: Schema.Types.ObjectId,
      ref: "Blog",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = model("History", historySchema);
