import { Router } from "express";
import { getUserDetails, verifyJWT, verifyUsersEmailVerifyed } from "../middlewares/auth.middleware.js";
import { addToWatchHistory, deleteVideoContent, getUploadedVideosByChannal, getUploadedVideosByCurrentuser, getVideo, newVideos, recommendedVideos, searchVideos, updateVideoDetails, updateVideoThumbnail, uploadedVideosState, uploadVideo } from "../controllers/video.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import multer from "multer";
import { ApiResponse } from "../utils/apiResponse.js";


const videoRouter = Router();

videoRouter.route("/upload").post(
    (req, res, next) => {
        // Use upload.fields and catch errors here
        upload.fields([
          {
            name: "video",
            maxCount: 1
          },
          {
            name: "thumbnail",
            maxCount: 1
          }
        ])(req, res, (err) => {
          if (err instanceof multer.MulterError) {
            // Handle Multer-specific errors (e.g., file size limit exceeded)
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res
                .status(400)
                .json(new ApiResponse(400, {}, "File size too large."));
            }
            return res.status(400).json(new ApiResponse(400, {}, err.message));
          } else if (err) {
            // Handle any other errors (e.g., invalid file type)
            return res.status(400).json(new ApiResponse(400, {}, err.message));
          }
          
          // If no error, proceed to the next middleware
          next();
        });
      },
    verifyUsersEmailVerifyed, uploadVideo);

videoRouter.route("/state").post(verifyUsersEmailVerifyed,uploadedVideosState);



videoRouter.route("/get").get(getUserDetails,getVideo);

videoRouter.route('/search').post(searchVideos);

videoRouter.route('/new').post(newVideos);

videoRouter.route('/recommended').post(recommendedVideos);

videoRouter.route('/current').get(verifyJWT,getUploadedVideosByCurrentuser);

videoRouter.route('/channal').get(verifyJWT,getUploadedVideosByChannal);

videoRouter.route('/add/history').post(getUserDetails,addToWatchHistory);



// owner update

videoRouter.route('/update/details').post(verifyJWT,updateVideoDetails);

videoRouter.route('/update/thumbnail').post(upload.fields([
    {
        name: "thumbnail",
        maxCount: 1
    }
]),verifyJWT,updateVideoThumbnail);

videoRouter.route('/delete').post(verifyJWT,deleteVideoContent);

export default videoRouter;