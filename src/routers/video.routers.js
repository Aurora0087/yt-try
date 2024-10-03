import { Router } from "express";
import { getUserDetails, verifyJWT, verifyUsersEmailVerifyed } from "../middlewares/auth.middleware.js";
import { addToWatchHistory, deleteVideoContent, getVideo, newVideos, recommendedVideos, searchVideos, updateVideoDetails, updateVideoThumbnail, uploadedVideosState, uploadVideo } from "../controllers/video.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";


const videoRouter = Router();

videoRouter.route("/upload").post(
    upload.fields([
        {
            name: "video",
            maxCount: 1
        },
        {
            name: "thumbnail",
            maxCount: 1
        }
    ]),verifyUsersEmailVerifyed, uploadVideo);

videoRouter.route("/state").post(verifyUsersEmailVerifyed,uploadedVideosState);



videoRouter.route("/get").get(getUserDetails,getVideo);

videoRouter.route('/search').post(searchVideos);

videoRouter.route('/new').post(newVideos);

videoRouter.route('/recommended').post(recommendedVideos);

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