import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import authRouter from './routes/auth.js'
import logger from "./middleware/logger.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

app.use(express.json());
app.use(cors({ origin: config.cors.origin }));
app.use(helmet());
app.use(logger);
app.use('/auth', authRouter);

app.use(errorHandler);

// Error Handlers
// 404
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});
// 500
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});


app.get("/", (req, res) => {
  res.send("Hello World!");
});

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
