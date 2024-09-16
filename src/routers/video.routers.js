import { Router } from "express";
import { getUserDetails, verifyUsersEmailVerifyed } from "../middlewares/auth.middleware.js";
import { getVideo, updateVideoProcess, updateVideoThumbnailFromEcs, uploadVideo } from "../controllers/video.controllers.js";
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

videoRouter.route("/get").get(getUserDetails,getVideo);

videoRouter.route("/update/process").post(updateVideoProcess);

videoRouter.route("/update/process/thumbnail").post(updateVideoThumbnailFromEcs);

export default videoRouter;