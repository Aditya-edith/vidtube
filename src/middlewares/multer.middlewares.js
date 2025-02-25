//for uploading using local storage
// import multer from "multer";

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "./public/temp");
//   },
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1e9);
//     cb(null, file.fieldname + "_" + uniqueSuffix);
//   },
// });

// export const upload = multer({
//   storage,
// });
import multer from "multer";

const storage = multer.memoryStorage(); // Store file in memory (RAM)
const upload = multer({ storage });

export default upload;
