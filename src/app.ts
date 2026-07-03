import express from 'express';
import cors from 'cors';
import './types'; // load the Express.Request `user` augmentation
import env from './config/env';
import routes from './routes';
import { notFoundHandler, errorHandler } from './middleware/error';

const app = express();

app.use(cors({ origin: env.corsOrigins }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// All endpoints live under /api/v1 — matches the client's
// VITE_API_BASE_URL=http://localhost:5000/api/v1
app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
