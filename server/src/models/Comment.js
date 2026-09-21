import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    issue: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

commentSchema.index({ issue: 1, createdAt: 1 });

commentSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Comment', commentSchema);
