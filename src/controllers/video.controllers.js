import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteLocalFiles } from "../utils/localFile.js";
import { deleteS3PublicImageFile, deleteS3PublicVideoFolder, uploadFileS3 } from "../utils/s3fileUpload.js";

import { ApiResponse } from "../utils/apiResponse.js";
import { Video } from "../models/video.models.js";
import mongoose from "mongoose";

import path from "path"
import { WatchHistory } from "../models/watchHistory.models.js";

// upload new video

const uploadVideo = asyncHandler(async (req, res) => {

  // taking text type fild
  const { title, description } = req.body;

  // taking files
  const video = req.files?.video ? req.files?.video[0] : null;
  const thumbnail = req.files?.thumbnail ? req.files?.thumbnail[0] : null;

  if (!title || String(title).trim().length < 1) {
    deleteLocalFiles([video?.path, thumbnail?.path]);
    return res
      .status(400)
      .json(new ApiResponse(400, {}, "Title are Require."));
  }

  if (!description || String(description).trim().length < 1) {
    deleteLocalFiles([video?.path, thumbnail?.path]);
    return res
      .status(400)
      .json(new ApiResponse(400, {}, "Video Description are Require."));
  }

  if (!video) {
    deleteLocalFiles([thumbnail?.path]);
    return res.status(400).json(new ApiResponse(400, {}, "Video not given."));
  }

  if (!thumbnail) {
    deleteLocalFiles([video?.path]);
    return res
      .status(400)
      .json(new ApiResponse(400, {}, "Thumbnail not given."));
  }

  if (!String(thumbnail?.mimetype).includes("image/")) {
    deleteLocalFiles([video?.path, thumbnail?.path]);
    return res
      .status(400)
      .json(
        new ApiResponse(400, {}, "Thumbnail file must be in image format.")
      );
  }

  if (!String(video?.mimetype).includes("video/mp4")) {
    deleteLocalFiles([video?.path, thumbnail?.path]);
    return res
      .status(400)
      .json(new ApiResponse(400, {}, "Video file must be in mp4 format."));
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Flush headers and start streaming

  try {
    const newVideoContent = await Video.create({
      title,
      description,
      thumbnail: "none",
      owner: new mongoose.Types.ObjectId(req.user._id || ""),
      duration: 0,
      isPublished: true,
    });

    // Progress callback to send progress updates
    const progressCallback = (progress) => {
      res.write(`data: ${JSON.stringify({ progress })}\n\n`);
    };

    // Upload files with progress tracking
    const videoFileName = `${newVideoContent._id}.mp4`;

    const thumbnailExtension = path.extname(thumbnail.filename);
    const thumbnailFileName = `${newVideoContent._id}${thumbnailExtension}`;

    await uploadFileS3(video.path, videoFileName, progressCallback);
    await uploadFileS3(thumbnail.path, thumbnailFileName, progressCallback);

    // Notify client of success
    res.write(`data: ${JSON.stringify({ message: "Upload complete" })}\n\n`);
    res.end(); // End the connection when done

  } catch (error) {

    deleteLocalFiles([video?.path, thumbnail?.path]);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end(); // Close the stream on error
  }
});

// get procees and error video

const uploadedVideosState = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const pipeline = [
    {
      $match: {
        owner: new mongoose.Types.ObjectId(req.user._id || ""),
        isProcessComplete: false,
      },
    },
    {
      $addFields: {
        state: {
          $cond: {
            if: { $eq: ["$isProcessCanceled", true] }, // Correct field reference
            then: "ERROR",
            else: "PROCESS",
          },
        },
        errorMessage: "$cancelMessage", // Correctly reference cancelMessage field
      },
    },
    {
      $project: {
        title: 1,
        createdAt: 1,
        state: 1,
        errorMessage: 1,
      },
    },
  ];

  // Use aggregatePaginate to paginate the results
  const options = { page, limit };

  const videos = await Video.aggregatePaginate(Video.aggregate(pipeline), options);

  res.status(200).json(
    new ApiResponse(200, { videos: videos }, "State of videos fetched successfully.")
  );
});


// get video by id for watch
const getVideo = asyncHandler(async (req, res) => {
  const vId = req.query?.v || "";

  const uId = req.user?._id || "";

  if (!mongoose.isValidObjectId(vId)) {
    return res.status(400).json(
      new ApiResponse(
        400,
        {},
        "Video Id not given properly."
      )
    )
  }

  // Find the video by ID
  const video = await Video.findById(vId);

  if (!video) {
    return res.status(404).json(
      new ApiResponse(
        404,
        {},
        "Video doesn't exist."
      )
    );
  }

  if (!video.isProcessComplete) {
    return res.status(400).json(
      new ApiResponse(
        400,
        {},
        "Video is not ready for viewing, try after some time."
      )
    );
  }

  if (!video.isPublished && video.owner !== uId) {
    return res.status(403).json(
      new ApiResponse(
        403,
        {},
        "Video is not publicly avalible for now."
      )
    );
  }

  const videoDetails = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(vId)
      }
    },
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "owner",
        as: "channal",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              foreignField: "channal",
              localField: "_id",
              as: "subscribers",
            }
          },
          {
            $addFields: {
              // count of subscriberes
              subscriberes: {
                $size: "$subscribers"
              },
              // find is current user subscribed to channalUserName
              isSubscribed: {
                $cond: {
                  if: { $in: [uId, "$subscribers.subscriber"] },
                  then: true,
                  else: false
                }
              }
            }
          },
          {
            $project: {
              avatar: 1,
              firstName: 1,
              lastName: 1,
              username: 1,
              subscriberes: 1,
              isSubscribed: 1
            }
          }
        ]
      }
    },
    // geetting like details
    {
      $lookup: {
        from: "likes",
        foreignField: "video",
        localField: "_id",
        as: "likelist",
      }
    },
    {
      $addFields: {
        channal: {
          $first: "$channal"
        },
        likes: {
          $size: "$likelist"
        },
        isLiked: {
          $cond: {
            if: { $in: [uId, "$likelist.likedBy"] },
            then: true,
            else: false
          }
        },
        canUpdate: {
          $cond: {
            if: { $eq: ["$owner", new mongoose.Types.ObjectId(uId) || ""] },
            then: true,
            else: false
          },

        }
      }

    },
    {
      $project: {
        title: 1,
        description: 1,
        videoTypes: 1,
        thumbnail: 1,
        vttFile: 1,
        channal: 1,
        duration: 1,
        views: 1,
        createdAt: 1,
        updatedAt: 1,
        likes: 1,
        isLiked: 1,
        canUpdate: 1,
        isPublished: 1
      }
    }
  ]);

  return res.status(200).json(
    new ApiResponse(200,
      {
        video: videoDetails[0]
      },
      "Video fatched."
    )
  )

});

// update video details

const updateVideoDetails = asyncHandler(async (req, res) => {
  const {
    vId,
    uId,
    newTitle,
    newDescription,
    newIsPublished
  } = req.body;

  if (!mongoose.isValidObjectId(vId)) {
    return res
      .status(400)
      .json(new ApiResponse(
        400,
        {},
        "video Id not given properly."))
  }

  const video = await Video.findById(vId);
  if (!video) {
    return res
      .status(404)
      .json(new ApiResponse(
        404,
        {},
        "video doesn't exist."))
  }

  if ((!newTitle || !newDescription) || (newTitle.length < 1 && newDescription.length < 1 && newIsPublished === video.isPublished)) {
    return res.status(400).json(new ApiResponse(
      400,
      {},
      "New filds not given properly."))
  }

  if (String(video.owner) !== String(uId)) {
    return res.status(403).json(new ApiResponse(
      403,
      {},
      "Unauthorized Request, You dont have permition to do this action."))
  }

  if (newTitle) {
    video.title = newTitle;
  }

  if (newDescription) {
    video.description = newDescription;
  }

  if (newIsPublished !== video.isPublished) {
    video.isPublished = newIsPublished;
  }

  video.save({ validateBeforeSave: false });

  return res.status(200).json(
    new ApiResponse(200,
      {
        video: video
      },
      "Video updated sueecssfully."
    )
  )

});

// update video thumbnail

const updateVideoThumbnail = asyncHandler(async (req, res) => {
  const thumbnail = req.files?.thumbnail ? req.files?.thumbnail[0] : null;

  const vId = req.query?.v || "";

  const uId = req.user?._id || "";

  if (!mongoose.isValidObjectId(vId)) {

    deleteLocalFiles([thumbnail?.path]);
    return res
      .status(400)
      .json(new ApiResponse(
        400,
        {},
        "video Id not given properly."))
  }

  const video = await Video.findById(vId);

  if (!video) {

    deleteLocalFiles([thumbnail?.path]);
    return res
      .status(404)
      .json(new ApiResponse(
        404,
        {},
        "Video don't exist."))
  }

  if (String(video.owner) !== String(uId)) {

    deleteLocalFiles([thumbnail?.path]);
    return res
      .status(403)
      .json(new ApiResponse(
        403,
        {},
        "Unauthorized Request, You dont have permition to do this action."))
  }

  if (!thumbnail) {

    deleteLocalFiles([thumbnail?.path]);
    return res
      .status(400)
      .json(new ApiResponse(
        400,
        {},
        "Thumbnail not given."))
  }

  if (!String(thumbnail?.mimetype).includes("image/")) {

    deleteLocalFiles([thumbnail?.path]);
    return res
      .status(400)
      .json(new ApiResponse(
        400,
        {},
        "Thumbnail file must be in image format."))
  }

  let s3Response = await uploadFileS3(thumbnail?.path, `${video._id}${path.extname(thumbnail.filename)}`);

  if (!s3Response) {
    return res
      .status(500)
      .json(new ApiResponse(
        500,
        {},
        "Somthing want wrong while uploading video thumbnail."));
  }

  s3Response = await deleteS3PublicImageFile((video.thumbnail).replace(`https://s3.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_S3_PUBLIC_IMAGE_BUCKET_NAME}/`, '') || "");

  if (!s3Response) {
    return res
      .status(500)
      .json(new ApiResponse(
        500,
        {},
        "Somthing want wrong while deleteing old video thumbnail."));
  }

  return res.status(200).json(
    new ApiResponse(200,
      "Video thumbnail uploaded sueecssfully, wait a min to see update."
    )
  )

});


// delete full video content

const deleteVideoContent = asyncHandler(async (req, res) => {

  const vId = req.query?.v || "";

  const uId = req.user?._id || "";

  if (!mongoose.isValidObjectId(vId)) {
    return res
      .status(400)
      .json(new ApiResponse(
        400,
        {},
        "video Id not given properly."))
  }

  const video = await Video.findById(vId);

  if (!video) {
    return res
      .status(404)
      .json(new ApiResponse(
        404,
        {},
        "Video don't exist."))
  }

  if (String(video.owner) !== String(uId)) {
    return res
      .status(403)
      .json(new ApiResponse(
        403,
        {},
        "Unauthorized Request, You dont have permition to do this action."))
  }

  let s3Response = await deleteS3PublicImageFile((video.thumbnail).replace(`https://s3.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_S3_PUBLIC_IMAGE_BUCKET_NAME}/`, '') || "");

  if (!s3Response) {
    return res
      .status(500)
      .json(new ApiResponse(
        500,
        {},
        "Somthing want wrong while deleteing video thumbnail."));
  }

  s3Response = await deleteS3PublicVideoFolder(video._id);

  if (!s3Response) {
    return res
      .status(500)
      .json(new ApiResponse(
        500,
        {},
        "Somthing want wrong while deleteing video files thumbnail."));
  }

  await video.deleteOne();

  return res.status(200).json(
    new ApiResponse(200,
      "Video thumbnail uploaded sueecssfully, wait a min to see update."
    )
  )

});

// add to watchHistory and incrise view

const addToWatchHistory = asyncHandler(async (req, res) => {

  const vId = req.query?.v || "";
  const uId = req.user?._id || "";

  // Validate the video ID
  if (!mongoose.isValidObjectId(vId)) {
    return res
      .status(400)
      .json(new ApiResponse(
        400,
        {},
        "video Id not given properly."))
  }

  // Find the video by ID
  const video = await Video.findById(vId);
  if (!video) {
    return res
      .status(404)
      .json(new ApiResponse(
        404,
        {},
        "Video don't exist."))
  }

  video.views += 1;
  await video.save();

  if (uId !== "") {

    // Check if the video is already in the user's watch history
    let watchHistory = await WatchHistory.findOne({
      owner: uId,
      video: vId,
    });

    if (!watchHistory) {
      // Create a new watch history entry if it doesn't exist
      watchHistory = await WatchHistory.create({
        owner: uId,
        video: vId,
        rewatched: 0
      });
    } else {
      // Increment the rewatched count if it does exist
      watchHistory.rewatched += 1;
      await watchHistory.save();
    }

  }


  return res.status(200).json(
    new ApiResponse(
      200,
      "Watch history updated successfully."
    )
  );
});

// search video

const searchVideos = asyncHandler(async (req, res) => {
  const searchParam = req.query?.search || "";

  if (!searchParam || String(searchParam).trim().length < 1) {
    return res
      .status(400)
      .json(new ApiResponse(
        400,
        {},
        "Search parameter not given properly."))
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;


  // Construct the aggregation pipeline
  const pipeline = [
    {
      $match: {
        $or: [
          { title: { $regex: searchParam, $options: "i" } },
          { description: { $regex: searchParam, $options: "i" } }
        ],
        isPublished: true,
        isProcessComplete:true
      },
    },
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "owner",
        as: "channal",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              foreignField: "channal",
              localField: "_id",
              as: "subscribers",
            },
          },
          {
            $project: {
              avatar: 1,
              firstName: 1,
              lastName: 1,
              username: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        foreignField: "video",
        localField: "_id",
        as: "likelist",
      },
    },
    {
      $addFields: {
        channal: { $first: "$channal" },
        likes: { $size: "$likelist" },
      },
    },
    {
      $project: {
        title: 1,
        videoTypes: 1,
        thumbnail: 1,
        channal: 1,
        duration: 1,
        views: 1,
        createdAt: 1,
        likes: 1,
      },
    },
  ];

  // Use aggregatePaginate to paginate the results
  const options = { page, limit };

  const videos = await Video.aggregatePaginate(Video.aggregate(pipeline), options);

  res.status(200).json(
    new ApiResponse(
      200,
      { videos: videos },
      "Searched video fetched successfully."
    )
  );
});

// recommended videose

const newVideos = asyncHandler(async (req, res) => {

  
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const pipeline = [
    {
      $match: {
        isPublished: true,
        isProcessComplete:true
      },
    },
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "owner",
        as: "channal",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              foreignField: "channal",
              localField: "_id",
              as: "subscribers",
            },
          },
          {
            $project: {
              avatar: 1,
              firstName: 1,
              lastName: 1,
              username: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        foreignField: "video",
        localField: "_id",
        as: "likelist",
      },
    },
    {
      $addFields: {
        channal: { $first: "$channal" },
        likes: { $size: "$likelist" },
      },
    },
    {
      $project: {
        title: 1,
        videoTypes: 1,
        thumbnail: 1,
        channal: 1,
        duration: 1,
        views: 1,
        createdAt: 1,
        likes: 1,
      },
    },
  ];

  // Use aggregatePaginate to paginate the results
  const options = { page, limit };

  const videos = await Video.aggregatePaginate(Video.aggregate(pipeline), options);

  res.status(200).json(
    new ApiResponse(
      200,
      { videos: videos },
      'New videoes fetched successfully.'
    )
  );
});


// recommended videose

const recommendedVideos = asyncHandler(async (req, res) => {
  res.status(200).json(
      new ApiResponse(
          200,
          {},
          "This endpoint is not rady yet."
      )
  )
});

export {
  uploadVideo,
  uploadedVideosState,
  getVideo,
  updateVideoDetails,
  updateVideoThumbnail,
  deleteVideoContent,
  addToWatchHistory,
  searchVideos,
  newVideos,
  recommendedVideos
};