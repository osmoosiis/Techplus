import mongoose from "mongoose";

const bookmarkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemType: { type: String, enum: ['news', 'job', 'hackathon'], default: 'news', index: true },
  articleTitle: { type: String, required: true },
  articleUrl: { type: String, required: true },
  articleImage: { type: String, default: null },
  articleSource: { type: String, default: null },
  category: { type: String, default: 'General' }, // enum removed
  description: { type: String, default: null }
}, { timestamps: true });

bookmarkSchema.index({ userId: 1, itemType: 1, articleUrl: 1 }, { unique: true });

export const Bookmark = mongoose.model("Bookmark", bookmarkSchema);