import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();


//APP.use used for middleware and config

app.use(cors({
    origin: process.env.CORE_ORIGIN,
    credentials: true
}));


app.use(express.json({
    limit: "32kb"
}));


app.use(express.urlencoded({
    extended: true,
    limit: "32kb"
}));

app.use(express.static("public"));

app.use(cookieParser());


// routes import

import videoRouter from "./routers/video.routers.js";
import subscriptionRouter from "./routers/subscription.routers.js";
import playlistRouter from "./routers/playlist.routers.js";
import communityRouter from "./routers/community.routers.js";
import commentRouter from "./routers/comment.routers.js";
import likeRouter from "./routers/like.routers.js";
import processRouter from "./routers/process.routers.js";
import userRouter from "./routers/users.routers.js";

//routes

app.get('/', async(_, res) => {
    return res.status(200).json({
        isServerRunning:true,
    })
})

app.use("/api/v1/users", userRouter);

app.use("/api/v1/videos", videoRouter);

app.use("/api/v1/playlist", playlistRouter);

app.use("/api/v1/community", communityRouter);

app.use("/api/v1/comments", commentRouter);

app.use("/api/v1/likes", likeRouter);

app.use("/api/v1/subscription", subscriptionRouter);



app.use('/api/v1/process', processRouter);

export { app };