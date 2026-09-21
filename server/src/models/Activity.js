import mongoose from 'mongoose';
import { ACTIVITY_ACTIONS } from '../utils/constants.js';

const activitySchema = new mongoose.Schema(
  {
    issue: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: ACTIVITY_ACTIONS, required: true },
    from: { type: String, default: null },
    to: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ issue: 1, createdAt: 1 });

activitySchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('Activity', activitySchema);
