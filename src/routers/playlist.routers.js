import { Router } from "express";

import { verifyJWT, getUserDetails } from "../middlewares/auth.middleware.js";
import {
    addVideos,
    arrangeVideoLists,
    createPlaylist,
    currentUserPlaylist,
    deletePlaylist,
    getChannalPlaylist,
    getPlaylist,
    removeAllVideos,
    removeVideos,
    updatePlaylistDetails
} from "../controllers/playlist.controller.js";

const playlistRouter = Router();

playlistRouter.route("/create").post(verifyJWT, createPlaylist);
playlistRouter.route("/addVideo").post(verifyJWT, addVideos);
playlistRouter.route("/arrangeList").post(verifyJWT, arrangeVideoLists);
playlistRouter.route("/update").post(verifyJWT, updatePlaylistDetails);

playlistRouter.route("/delete").post(verifyJWT, deletePlaylist);
playlistRouter.route("/delete/videos").post(verifyJWT, removeVideos);
playlistRouter.route("/delete/allVideo").post(verifyJWT, removeAllVideos);

playlistRouter.route("/current").get(verifyJWT, currentUserPlaylist);
playlistRouter.route("/channel").post(getUserDetails, getChannalPlaylist);
playlistRouter.route("/get").get(getUserDetails, getPlaylist);

export default playlistRouter;

