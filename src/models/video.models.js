import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoQulityDetail = new Schema({
    qulity: {
        type: String,
        enum: ["360p", "720p", "1080p"],
        require: true
    },
    videoUrl: {
        type: String,
        require: true
    }
}, { timestamps: true });


const videoSchema = new Schema(
    {
        title: {
            type: String,
            required: [true, "Title is required"],
            minlength: [1, "Title must be at least 1 character long"],
            index: true,
        },
        description: {
            type: String,
            required: [true, "Description is required"],
            minlength: [1, "Description must be at least 1 character long"],
            index: true,
        },
        videoTypes: [
            {
                type : videoQulityDetail
            }
        ],
        thumbnail: {
            type: String,
            required: [true, "Thumbnail is required"],
        },
        vttFile:{
            type:String,
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Owner is required"],
        },
        isProcessComplete: {
            type: Boolean,
            default: false,
            required: true
        },
        isPrecessCanceled: {
            type: Boolean,
            default: false,
            required: true
        },
        cancelMessage: {
            type: String,
        },
        duration: {
            type: Number,
            default: 0,
        },
        views: {
            type: Number,
            default: 0,
        },
        isPublished: {
            type: Boolean,
            require: true,
            default: true,
        },
    },
    { timestamps: true }
);

// Create a text index for full-text search on title and description
videoSchema.index({ title: "text", description: "text" });

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);