import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteLocalFiles } from "../utils/localFile.js";
import { uploadFileS3 } from "../utils/s3fileUpload.js";

import { ApiResponse } from "../utils/apiResponse.js";
import { Video } from "../models/video.models.js";
import mongoose from "mongoose";

const uploadVideo = asyncHandler(async (req, res) => {
  // taking text type fild
  const { title, description } = req.body;

  // taking files
  const video = req.files?.video ? req.files?.video[0] : null;
  const thumbnail = req.files?.thumbnail ? req.files?.thumbnail[0] : null;

  try {
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

    //
    const newVideoContent = await Video.create({
      title: title,
      description: description,
      thumbnail: "none",
      owner: new mongoose.Types.ObjectId(req.user._id || ""),
      duration: 0,
      isPublished: true,
    });

    if (!newVideoContent) {
      return res
        .status(500)
        .json(
          new ApiResponse(
            500,
            {},
            "Somthing want wrong while creating video details."
          )
        );
    }

    const videoFileName = newVideoContent._id + ".mp4";
    const thumbnailFileName = thumbnail.filename;

    const videoLocalPath = video?.path;
    const thumbnailLocalPath = thumbnail?.path;

    let s3Response = await uploadFileS3(videoLocalPath, videoFileName);

    if (!s3Response) {
      await newVideoContent.deleteOne();
      return res
        .status(500)
        .json(
          new ApiResponse(500, {}, "Somthing want wrong while uploading video.")
        );
    }

    s3Response = await uploadFileS3(thumbnailLocalPath, thumbnailFileName);

    if (!s3Response) {
      await newVideoContent.deleteOne();
      return res
        .status(500)
        .json(
          new ApiResponse(
            500,
            {},
            "Somthing want wrong while uploading video thumbnail."
          )
        );
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          video: newVideoContent,
        },
        "Video uploaded successfully."
      )
    );
  } catch (error) {
    deleteLocalFiles([video?.path, thumbnail?.path]);
    return res
      .status(500)
      .json(
        new ApiResponse(
          500,
          {},
          `Somthing goes wrong while uploading videos. Error : ${String(error)}`
        )
      );
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

    console.log("Received request with body:", req.body);

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


export { uploadVideo, getVideo, updateVideoProcess };
