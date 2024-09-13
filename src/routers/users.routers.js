import { Router } from "express";
import { incomingRefreshToken, loginUser, registerUser, verifyEmail } from "../controllers/user.controllers.js";



const userRouter = Router();

userRouter.route("/register").post(registerUser);

userRouter.route("/verify").get(verifyEmail);

userRouter.route("/login").post(loginUser);

userRouter.route("/refreshToken").get(incomingRefreshToken);

export default userRouter;