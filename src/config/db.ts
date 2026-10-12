import mongoose from "mongoose";
import env from "./env";
import logger from "./logger";

export const connectDB = async (): Promise<void> => {
  try {
    if (!env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined.");
    }

    logger.info("Connecting to MongoDB...");

    const conn = await mongoose.connect(env.MONGODB_URI);

    logger.info(`MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on("error", (err) => {
      logger.error(`MongoDB connection error: ${err.message}`, {
        stack: err.stack,
      });
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected");
    });
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`MongoDB connection failed: ${error.message}`, {
        stack: error.stack,
      });

      // Temporary debugging
      console.error("MongoDB Error:", error);
    } else {
      logger.error("MongoDB connection failed with an unknown error.");
      console.error(error);
    }

    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.connection.close();
  logger.info("MongoDB connection closed");
};
