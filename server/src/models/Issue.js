import mongoose from 'mongoose';
import { SEVERITIES, PRIORITIES, STATUSES } from '../utils/constants.js';

const issueSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // e.g. BB-12
    number: { type: Number, required: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    description: { type: String, required: true, trim: true, minlength: 5, maxlength: 5000 },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    severity: { type: String, enum: SEVERITIES, default: 'Medium', required: true },
    priority: { type: String, enum: PRIORITIES, default: 'Medium', required: true },
    status: { type: String, enum: STATUSES, default: 'Open', required: true },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Denormalised numeric ranks (Low=0 ... Critical=3) so lists can sort by logical order using a
    // plain indexed sort instead of an aggregation. Kept in sync by the pre-validate hook below.
    severityRank: { type: Number, default: 1 },
    priorityRank: { type: Number, default: 1 },
    statusRank: { type: Number, default: 0 },
  },
  { timestamps: true }
);

issueSchema.pre('validate', function setRanks(next) {
  this.severityRank = SEVERITIES.indexOf(this.severity);
  this.priorityRank = PRIORITIES.indexOf(this.priority);
  this.statusRank = STATUSES.indexOf(this.status);
  next();
});

// Query-pattern driven indexes (project lists, filters, dashboards, "my issues").
issueSchema.index({ project: 1, status: 1 });
issueSchema.index({ project: 1, createdAt: -1 });
issueSchema.index({ assignee: 1, status: 1 });
issueSchema.index({ reporter: 1 });
issueSchema.index({ priority: 1 });
issueSchema.index({ severity: 1 });
issueSchema.index({ updatedAt: -1 });
issueSchema.index({ title: 'text', description: 'text' });

issueSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    delete ret.severityRank;
    delete ret.priorityRank;
    delete ret.statusRank;
    return ret;
  },
});

export default mongoose.model('Issue', issueSchema);
