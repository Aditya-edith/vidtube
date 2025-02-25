// import { v2 as cloudinary } from "cloudinary";
// import fs from "fs";
// import dotenv from "dotenv";
// import { publicEncrypt } from "crypto";

// dotenv.config();

// // Configuration
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// const uploadOnCloudinary = async (localFilePath) => {
//   try {
//     if (!localFilePath) return null;

//     // Upload the file to Cloudinary
//     const response = await cloudinary.uploader.upload(localFilePath, {
//       resource_type: "auto",
//     });

//     // Log the URL of the uploaded file
//     console.log("File uploaded on Cloudinary. File URL: " + response.url);

//     // Once the file is uploaded, delete it from the local server
//     fs.unlinkSync(localFilePath);

//     // Return the response object which contains the URL and other details
//     return response;
//   } catch (error) {
//     // If there's an error, delete the local file and log the error
//     if (fs.existsSync(localFilePath)) {
//       fs.unlinkSync(localFilePath);
//     }
//     console.error("Error uploading file to Cloudinary:", error);
//     return null;
//   }
// };

// const deleteFromCloudinary = async (publicId) => {
//   try {
//     // Delete the file from Cloudinary
//     const response = await cloudinary.uploader.destroy(publicId);
//     console.log("File deleted from Cloudinary , Public Id :", publicId);
//   } catch (error) {
//     console.log("Error deleting from cloudinary", error);
//     return null;
//   }
// };

// export { uploadOnCloudinary, deleteFromCloudinary };

import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (fileBuffer) => {
  try {
    if (!fileBuffer) return null;

    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: "auto" }, (error, result) => {
          if (error) {
            console.error("Cloudinary Upload Error:", error);
            reject(error);
          } else {
            console.log("File uploaded to Cloudinary. URL:", result.secure_url);
            resolve(result);
          }
        })
        .end(fileBuffer); // Upload file buffer directly
    });
  } catch (error) {
    console.error("Error uploading file to Cloudinary:", error);
    return null;
  }
};

const deleteFromCloudinary = async (publicId) => {
  try {
    const response = await cloudinary.uploader.destroy(publicId);
    console.log("File deleted from Cloudinary, Public ID:", publicId);
    return response;
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    return null;
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };
