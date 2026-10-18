import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './auth.routes.js';
import projectRoutes from './project.routes.js';
import issueRoutes from './issue.routes.js';
import userRoutes from './user.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import aiRoutes from './ai.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      uptime: Math.round(process.uptime()),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/issues', issueRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/ai', aiRoutes);

export default router;
