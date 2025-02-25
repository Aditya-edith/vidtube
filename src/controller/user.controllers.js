import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import fs from "fs";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    //small check for user existence
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    const accessToken = User.generateAccessToken();
    const refreshToken = User.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while genereating access and refresh token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // Destructure fields from req.body
  const { fullName, email, username, password } = req.body;

  // Validate fields
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // Check if user already exists
  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with this email or username already exists");
  }

  // Handle avatar and cover image uploads
  // let avatarLocalPath;
  // console.log("req files", req.files); //logging the req file(images)
  // if (
  //   req.files &&
  //   Array.isArray(req.files.avatar) &&
  //   req.files.avatar.length > 0
  // ) {
  //   avatarLocalPath = req.files.avatar[0].path;
  // }

  // if (!avatarLocalPath) {
  //   throw new ApiError(400, "Avatar file is required");
  // }

  // let coverImageLocalPath;
  // if (
  //   req.files &&
  //   Array.isArray(req.files.coverImage) &&
  //   req.files.coverImage.length > 0
  // ) {
  //   coverImageLocalPath = req.files.coverImage[0].path;
  // }

  // // Upload avatar to Cloudinary
  // const avatar = await uploadOnCloudinary(avatarLocalPath);
  // if (!avatar) {
  //   throw new ApiError(500, "Failed to upload avatar");
  // }

  // // Upload cover image to Cloudinary (if provided)
  // let coverImage;
  // if (coverImageLocalPath) {
  //   coverImage = await uploadOnCloudinary(coverImageLocalPath);
  // }

  // Logging uploaded files
  console.log("req files", req.files);

  // Extract avatar and coverImage buffers
  const avatarBuffer = req.files?.avatar?.[0]?.buffer;
  const coverImageBuffer = req.files?.coverImage?.[0]?.buffer;

  if (!avatarBuffer) {
    throw new ApiError(400, "Avatar file is required");
  }

  // Upload files directly to Cloudinary
  const avatar = await uploadOnCloudinary(avatarBuffer);
  if (!avatar) {
    throw new ApiError(500, "Failed to upload avatar");
  }

  let coverImage;
  if (coverImageBuffer) {
    coverImage = await uploadOnCloudinary(coverImageBuffer);
  }

  try {
    // Create user in the database
    const user = await User.create({
      fullName,
      email,
      username: username.toLowerCase(),
      password, // Password will be hashed by Mongoose middleware
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
    });

    // Fetch the created user without sensitive fields
    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if (!createdUser) {
      throw new ApiError(
        500,
        "Something went wrong while registering the user"
      );
    }

    // Delete local files after successful upload
    // if (fs.existsSync(avatarLocalPath)) {
    //   fs.unlinkSync(avatarLocalPath);
    // } else {
    //   console.warn(`File not found: ${avatarLocalPath}`);
    // }
    // if (coverImageLocalPath) {
    //   fs.unlinkSync(coverImageLocalPath);
    // }

    // Return success response
    return res
      .status(201)
      .json(new ApiResponse(201, createdUser, "User registered successfully"));
  } catch (error) {
    //Delete local files if they exist
    // if (fs.existsSync(avatarLocalPath)) {
    //   fs.unlinkSync(avatarLocalPath);
    // }
    // if (coverImageLocalPath) {
    //   if (fs.existsSync(coverImageLocalPath)) {
    //     fs.unlinkSync(coverImageLocalPath);
    //   } else {
    //     console.log(`File not found: ${coverImageLocalPath}`);
    //   }
    // }
    // const deleteFileIfExists = (filePath) => {
    //   const absolutePath = path.resolve(filePath);
    //   console.log(`Checking for file: ${absolutePath}`);
    //   if (fs.existsSync(absolutePath)) {
    //     fs.unlinkSync(absolutePath);
    //     console.log(`File deleted: ${absolutePath}`);
    //   } else {
    //     console.warn(`File not found: ${absolutePath}`);
    //   }
    // };

    // // Usage
    // if (coverImageLocalPath) {
    //   deleteFileIfExists(coverImageLocalPath);
    // }
    // if (avatarLocalPath) {
    //   deleteFileIfExists(avatarLocalPath);
    // }

    // Throw the error
    console.error("Error during user registration:", error);

    // Only delete images if they were uploaded successfully
    if (avatar?.public_id) {
      console.log(`Deleting avatar from Cloudinary: ${avatar.public_id}`);
      await deleteFromCloudinary(avatar.public_id);
    }
    if (coverImage?.public_id) {
      console.log(
        `Deleting cover image from Cloudinary: ${coverImage.public_id}`
      );
      await deleteFromCloudinary(coverImage.public_id);
    }

    throw new ApiError(500, error.message || "Failed to register user");
  }
});

const loginUser = asyncHandler(async (req, res) => {
  //get data from body
  const { email, username, password } = req.body;
  //validation
  if (!email || !username || !password) {
    throw new ApiError(400, "Each field is required");
  }

  // Check if user already exists
  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(400, "User not found");
  }

  //validate password
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid password");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!loggedInUser) {
    throw new ApiError(500, "Failed to login user");
  }

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.accessToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "No refresh token provided");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh Token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Invalid refresh Token");
    }

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };
    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access Token refreshed Successfully !"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while refreshing access token"
    );
  }
});

const changeUserPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordvalid = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordvalid) {
    throw new ApiError(401, "Invalid Old Password");
  }

  user.password = newPassword;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed Successfully !"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User found Successfully !"));
});

const updateAccountsDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "Please provide all fields");
  }

  // Check if email is already in use by another user
  const existingUser = await User.findOne({ email });
  if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
    throw new ApiError(400, "Email already in use");
  }

  // Update user details
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { fullName, email } },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User updated successfully!"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarBuffer = req.files?.avatar?.[0]?.buffer;
  if (!avatarBuffer) {
    throw new ApiError(400, "Please provide an avatar");
  }

  const avatar = await uploadOnCloudinary(avatarBuffer);

  if (!avatar.url) {
    throw new ApiError(400, "Failed to upload avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar uploaded Successfully !"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageBuffer = req.files?.coverImage?.[0]?.buffer;

  if (!coverImageBuffer) {
    throw new ApiError(400, "Please provide a cover image");
  }

  const coverImage = await uploadOnCloudinary(coverImageBuffer);

  if (!coverImage.url) {
    throw new ApiError(400, "Failed to upload cover image");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image uploaded Successfully !"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username) {
    throw new ApiError(400, "Username is required");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      //project only the necessary data
      $project: {
        fullName: 1,
        username: 1,
        avatar: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  console.log("channel details", channel);

  if (!channel?.length) {
    throw new ApiError(404, "Channel not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "Channel profile fetched sucessfully")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
      },
    },
    {
      $project: {
        watchHistory: 1, // Return only watch history
      },
    },
  ]);

  if (!user.length) {
    throw new ApiError(404, "User not found or no watch history available");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  updateUserCoverImage,
  updateUserAvatar,
  updateAccountsDetails,
  getCurrentUser,
  changeUserPassword,
  getUserChannelProfile,
  getWatchHistory,
};
