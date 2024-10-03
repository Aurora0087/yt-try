import { Router } from "express";
import { updateErrorVideoFileProcess, updateImageFileFromEcs, updateVideoFileProcess } from "../controllers/fileProcess.controllers.js";

const processRouter = Router();

processRouter.route('/videos').post(updateVideoFileProcess);

processRouter.route('/images').post(updateImageFileFromEcs);

processRouter.route('/error').post(updateErrorVideoFileProcess);


export default processRouter;