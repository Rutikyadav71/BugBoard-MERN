import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    key: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z][A-Z0-9]{1,9}$/, 'Key must be 2-10 characters, letters/digits, starting with a letter'],
    },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Atomic counter used to build per-project issue keys such as BB-12.
    issueCounter: { type: Number, default: 0 },
  },
  { timestamps: true }
);

projectSchema.index({ members: 1 });
projectSchema.index({ createdBy: 1 });
projectSchema.index({ name: 'text', description: 'text' });

projectSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Project', projectSchema);
