import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteLocalFiles } from "../utils/localFile.js";
import { uploadFileS3 } from "../utils/s3fileUpload.js";

import { ApiResponse } from "../utils/apiResponse.js";
import { Video } from "../models/video.models.js";
import mongoose from "mongoose";

import path from "path"

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

    const thumbnailExtension  = path.extname(thumbnail.filename);
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



const getVideo = asyncHandler(async (req, res) => {});

const updateVideoProcess = asyncHandler(async (req, res) => {
  try {
    const {
      secretKey = "",
      hlsVideoUrls = [],
      vttFileUrl = "",
      objKey = "",
      videoDuration = 0,
    } = req.body;

    if (String(secretKey) !== String(process.env.DB_VIDEO_PROCESS_UPDATE_SECRET)) {
      return res
        .status(403)
        .json(new ApiResponse(403, {}, "You are not allowed to access this route."));
    }

    const vId = String(objKey).replace(".mp4", "");

    if (!mongoose.isValidObjectId(vId)) {
      return res
        .status(400)
        .json(new ApiResponse(400, {}, "Invalid Video ID derived from ObjKey."));
    }

    const video = await Video.findById(vId);

    if (!video) {
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Cannot find video by ID."));
    }

    const hlsUrls = [
      { quality: "360p", videoUrl: "" },
      { quality: "720p", videoUrl: "" },
      { quality: "1080p", videoUrl: "" },
    ];

    hlsVideoUrls.forEach((url) => {
      if (url.includes("hls/video-360P")) {
        hlsUrls[0].videoUrl = url;
      } else if (url.includes("hls/video-720P")) {
        hlsUrls[1].videoUrl = url;
      } else if (url.includes("hls/video-1080P")) {
        hlsUrls[2].videoUrl = url;
      }
    });

    video.duration = videoDuration;
    video.isProcessComplete = true;
    video.videoTypes = hlsUrls;
    video.vttFile = vttFileUrl;

    await video.save();

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Video details updated successfully."));
  } catch (error) {
    console.error("Error updating video details:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, `Something went wrong while updating video details: ${error.message}`));
  }
});

const updateVideoThumbnailFromEcs = asyncHandler(async(req,res) =>{

  try {
    const {
      secretKey = "",
      objKey = "",
      webpImageUrl = "",
    } = req.body;
  
    if (String(secretKey) !== String(process.env.DB_VIDEO_PROCESS_UPDATE_SECRET)) {
      return res
        .status(403)
        .json(new ApiResponse(403, {}, "You are not allowed to access this route."));
    }
  
    const vId = String(objKey).replace(/\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i, "");
  
    if (!mongoose.isValidObjectId(vId)) {
      return res
        .status(400)
        .json(new ApiResponse(400, {}, "Invalid Video ID derived from ObjKey."));
    }
  
    const video = await Video.findById(vId);
  
    if (!video) {
      return res
        .status(404)
        .json(new ApiResponse(404, {}, "Cannot find video by ID."));
    }
  
    video.thumbnail= webpImageUrl;
  
    await video.save();
  
    return res.status(200).json(
      new ApiResponse(
        200,
        {},
        "Image Url seated."
      )
    )
  } catch (error) {
    console.log("Somthing goes wrong while updateing thamnail : ", error);
    return res.status(500).json(
      new ApiResponse(
        500,
        {},
        `Somthing goes wrong while updateing thamnail :  ${error}`
      )
    )
    
  }
})


export { uploadVideo, getVideo, updateVideoProcess, updateVideoThumbnailFromEcs };