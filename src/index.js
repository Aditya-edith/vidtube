import { app } from "./app.js";
import dotenv from "dotenv";
import connectDB from "./db/index.js";

dotenv.config({
  path: "./.env",
});

const PORT = process.env.PORT || 8080;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is listening on Port : ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("MongoDb connection Error", err);
  });
