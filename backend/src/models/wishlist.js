import mongoose from 'mongoose';

const wishlistItemSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  },
  { timestamps: true }
);

// A student can save a job once; saving again is idempotent.
wishlistItemSchema.index({ user: 1, job: 1 }, { unique: true });
wishlistItemSchema.index({ user: 1, createdAt: -1 });

export const WishlistItem = mongoose.model('WishlistItem', wishlistItemSchema);