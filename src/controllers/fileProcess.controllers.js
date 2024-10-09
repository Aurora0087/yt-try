import { asyncHandler } from "../utils/asyncHandler.js";

import { ApiResponse } from "../utils/apiResponse.js";

import { Video } from "../models/video.models.js";
import {User} from "../models/user.models.js";
import mongoose from "mongoose";
import { Community } from "../models/community.models.js";


const updateVideoFileProcess = asyncHandler(async (req, res) => {
    try {
        const {
            secretKey = "",
            hlsVideoUrls = [],
            vttFileUrl = "",
            objKey = "",
            videoDuration = 0,
            masterVideoUrl = ""
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
            { quality: "480p", videoUrl: "" },
            { quality: "720p", videoUrl: "" },
            { quality: "1080p", videoUrl: "" },
        ];

        hlsVideoUrls.forEach((url) => {
            if (url.includes("hls/360p")) {
                hlsUrls[0].videoUrl = url;
            } else if (url.includes("hls/480p")) {
                hlsUrls[1].videoUrl = url;
            } else if (url.includes("hls/720p")) {
                hlsUrls[2].videoUrl = url;
            } else if (url.includes("hls/1080p")) {
                hlsUrls[3].videoUrl = url;
            }
        });

        video.duration = videoDuration;
        video.isProcessComplete = true;
        video.videoTypes = hlsUrls;
        video.vttFile = vttFileUrl;
        video.masterVideoUrl = masterVideoUrl;

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

const updateImageFileFromEcs = asyncHandler(async (req, res) => {

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

        let id = '';

        if (objKey.includes('uid-avatar')) {

            id = String(objKey).replace('uid-avatar', '').replace(/\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i, '');


            if (!mongoose.isValidObjectId(id)) {
                return res
                    .status(400)
                    .json(new ApiResponse(400, {}, "Invalid user ID derived from ObjKey."));
            }

            const user = await User.findById(id);

            if (!user) {
                return res
                .status(404)
                .json(new ApiResponse(404, {}, "Cannot find user by ID."));
            }

            user.avatar = webpImageUrl;

            await user.save();

            return res.status(200).json(
                new ApiResponse(
                    200,
                    {},
                    "Image Url Seated."
                )
            )
        }
        else if (objKey.includes('uid-bg')) {

            id = String(objKey).replace('uid-bg', '').replace(/\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i, '');

            if (!mongoose.isValidObjectId(id)) {
                return res
                    .status(400)
                    .json(new ApiResponse(400, {}, "Invalid user ID derived from ObjKey."));
            }

            const user = await User.findById(id);

            if (!user) {
                return res
                .status(404)
                .json(new ApiResponse(404, {}, "Cannot find user by ID."));
            }

            user.bg = webpImageUrl;

            await user.save();

            return res.status(200).json(
                new ApiResponse(
                    200,
                    {},
                    "Image Url Seated."
                )
            )
        }
        else if (objKey.includes('communityId-')) {
            id = String(objKey).replace('communityId-', '').replace(/\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i, '');

            if (!mongoose.isValidObjectId(id)) {
                return res
                    .status(400)
                    .json(new ApiResponse(400, {}, "Invalid user ID derived from ObjKey."));
            }

            const community = await Community.findById(id);

            if (!community) {
                return res
                .status(404)
                .json(new ApiResponse(404, {}, "Cannot find community by ID."));
            }

            community.image = webpImageUrl;

            await community.save();

            return res.status(200).json(
                new ApiResponse(
                    200,
                    {},
                    "Image Url Seated."
                )
            )
        }

        id = String(objKey).replace(/\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i, '');

        if (!mongoose.isValidObjectId(id)) {
            return res
                .status(400)
                .json(new ApiResponse(400, {}, "Invalid Video ID derived from ObjKey."));
        }

        const video = await Video.findById(id);

        if (!video) {
            return res
                .status(404)
                .json(new ApiResponse(404, {}, "Cannot find video by ID."));
        }

        video.thumbnail = webpImageUrl;

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
});

const updateErrorVideoFileProcess = asyncHandler(async(req,res)=>{

    const {
        secretKey = "",
        objKey = "",
        errorMessage = "500 Error"
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

    video.isPrecessCanceled = true;
    video.cancelMessage = errorMessage;


    await video.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(
            200,
            {},
            "Updated"
        )
    )
})


export {
    updateVideoFileProcess,
    updateImageFileFromEcs,
    updateErrorVideoFileProcess
}