import { Router } from "express";
import { changePassword, forgotPassword, forgotPasswordEmail, getChannal, getCurrentUser, incomingRefreshToken, loginUser, logOut, registerUser, updateAvatar, updateCurrentUser, verifyEmail } from "../controllers/user.controllers.js";
import { getUserDetails, verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";



const userRouter = Router();

// open route

userRouter.route("/register").post(registerUser);

userRouter.route("/verify").get(verifyEmail);

userRouter.route("/login").post(loginUser);

userRouter.route("/refreshToken").get(incomingRefreshToken);

userRouter.route("/email/forgotPassword").post(forgotPasswordEmail);

userRouter.route("/forgotPassword").post(forgotPassword);

userRouter.route("/channel").get(getUserDetails,getChannal);

// verifyed route

userRouter.route("/logout").get(verifyJWT,logOut);

userRouter.route("/changePassword").post(verifyJWT,changePassword);

userRouter.route("/current").get(verifyJWT,getCurrentUser);

userRouter.route("/update/details").post(verifyJWT,updateCurrentUser);

userRouter.route("/update/avatar").post(upload.fields([
    {
        name: "avatar",
        maxCount: 1
    },{
        name: "bg",
        maxCount: 1
    }
]),verifyJWT,updateAvatar);

export default userRouter;