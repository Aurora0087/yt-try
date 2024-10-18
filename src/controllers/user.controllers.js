import { User } from "../models/user.models.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteLocalFiles } from "../utils/localFile.js";
import { sendForgotPassword, sendVerificationEmail } from "../utils/mails.js";

import jwt from "jsonwebtoken";
import { deleteS3PublicImageFile, uploadFileS3 } from "../utils/s3fileUpload.js";

import path from "path";
import { ForgotPassword } from "../models/ForgotPassword.models.js";
import mongoose from "mongoose";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// httpcokie
const cookieOption = {
    httpOnly: true,
    secure: true,
    expires: new Date(Date.now() + (3 * 30 * 24 * 3600000))
};

// funtion for generateTokens and save in db

async function generateAccessTokenAndRefreshToken(uid) {
    try {
        const user = await User.findById(uid);

        const accesToken = await user.generateAccessToken();

        const refreshToken = await user.generateRefreshToken();

        // set new refreshToken in user db

        user.refreshToken = refreshToken;

        user.lastOnline = Date.now();

        await user.save({ validateBeforeSave: false });

        return { accesToken, refreshToken };
    } catch (error) {
        console.log(error);
        throw new ApiError(500, "Somthing went wrong while generating token.");
    }
}

// register new user

const registerUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, username, email, password } = req.body;

    if (
        [firstName, lastName, email, username, password].some(
            (fild) => String(fild).trim().length < 1
        )
    ) {
        return res
            .status(400)
            .json(new ApiResponse(400, {}, "All Filds are Require."));
    }

    if (!emailRegex.test(email)) {
        return res
            .status(400)
            .json(new ApiResponse(400, {}, "Invalid email address."));
    }

    // cheack user exist with username or email yes{return user exist} no{next}

    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existedUser) {
        return res
            .status(409)
            .json(
                new ApiResponse(409, {}, "User with username or email already exist.")
            );
    }

    // genaret email varify token

    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let emailVerificationToken = "";

    for (let i = 0; i < 20; i++) {
        emailVerificationToken += characters.charAt(
            Math.floor(Math.random() * characters.length)
        );
    }

    // register user

    const createdUser = await User.create({
        avatar: "",
        firstName: firstName,
        lastName: lastName,
        username: username,
        email: email,
        password: password,
        emailVerificationToken: emailVerificationToken,
    });

    const newUser = await User.findById(createdUser._id).select(
        "-password -refreshToken -emailVerificationToken -role "
    );

    if (!newUser) {
        return res
            .status(500)
            .json(
                new ApiResponse(
                    500,
                    {},
                    "Somthing want wrong while registering new user."
                )
            );
    }

    // sent varification email to email address

    const mailRes = await sendVerificationEmail(
        email,
        emailVerificationToken,
        newUser._id
    );

    // give response

    return res
        .status(201)
        .json(new ApiResponse(200, newUser, "User Registered sccess fully."));
});

// email verify

const verifyEmail = asyncHandler(async (req, res) => {
    const token = req.query.token;
    const uId = req.query.uId;

    if (!token || String(token).length < 10) {
        return res.status(400).json(new ApiResponse(400, {}, "Token not given."));
    }

    if (!uId || String(uId).length < 10) {
        return res.status(400).json(new ApiResponse(400, {}, "Uid not given."));
    }

    const user = await User.findById(uId);

    if (!user) {
        return res.status(404).json(new ApiResponse(404, {}, "User not found."));
    }

    const isSameToken = user.emailVerificationToken === token;

    if (!isSameToken) {
        return res
            .status(400)
            .json(new ApiResponse(400, {}, "Token is not correct."));
    }

    user.isEmailVerified = true;

    await user.save();

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Email verify succesfully."));
});

// login user

const loginUser = asyncHandler(async (req, res) => {
    //get username / email and password

    const { username, password } = req.body;

    //validate username / email and password

    if (!username || !password) {
        return res
            .status(400)
            .json(
                new ApiResponse(400, {}, "Username/Email or Password not given properly.")
            );
    }

    if ([username, password].some((fild) => String(fild).trim().length < 1)) {
        return res
            .status(400)
            .json(
                new ApiResponse(400, {}, "Username/Email or Password not given properly.")
            );
    }

    //user exist with username or email

    const user = await User.findOne({
        $or: [{ username: username }, { email: username }],
    });

    if (!user) {
        return res.status(404).json(new ApiResponse(404, {}, "User do not exist."));
    }

    //check password

    const isPasswordValid = await user.isPasswordCurrect(password);

    if (!isPasswordValid) {
        return res.status(401).json(new ApiResponse(401, {}, "Password incorrect."));
    }

    //genarete tokens

    const { accesToken, refreshToken } = await generateAccessTokenAndRefreshToken(
        user._id
    );

    //send token cookices

    return res
        .status(200)
        .cookie("accesToken", accesToken, cookieOption)
        .cookie("refreshToken", refreshToken, cookieOption)
        .json(
            new ApiResponse(
                200,
                {
                    userName: user.username,
                    uid: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    avatar: user.avatar
                },
                "User Login Successfully."
            )
        );
});

// logout

const logOut = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $unset: {
                refreshToken: 1,
            },
        },
        {
            new: true,
        }
    );

    return res
        .status(200)
        .clearCookie("accesToken", cookieOption)
        .clearCookie("refreshToken", cookieOption)
        .json(new ApiResponse(200, {}, "User Logout Successfully."));
});

// refreshTokens

const incomingRefreshToken = asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken || "";

    if (token.length < 1) {
        return res
            .status(401)
            .json(
                new ApiResponse(
                    401,
                    {},
                    "You dont have RefreshToken, try to login again."
                )
            );
    }

    // decoding token

    const decodedToken = await jwt.verify(
        token,
        process.env.REFRESH_TOKEN_SECRET
    );

    // validating

    if (!decodedToken) {
        return res
            .status(401)
            .json(
                new ApiResponse(401, {}, "Invalid refeshToken, try to login again.")
            );
    }

    const user = await User.findById(decodedToken?.uid || "").select(
        "-password "
    );

    if (!user) {
        return res
            .status(401)
            .json(
                new ApiResponse(401, {}, "Invalid refeshToken , try to login again.")
            );
    }

    if (token !== user.refreshToken) {
        return res
            .status(401)
            .json(
                new ApiResponse(
                    401,
                    {},
                    "RefreshToken expired or using old token, try to login again."
                )
            );
    }

    // generate new tokens

    const { accesToken, refreshToken } = await generateAccessTokenAndRefreshToken(
        user._id
    );

    //send token cookices

    return res
        .status(200)
        .cookie("accesToken", accesToken, cookieOption)
        .cookie("refreshToken", refreshToken, cookieOption)
        .json(
            new ApiResponse(
                200,
                {
                    userName: user.username,
                    uid: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    avatar: user.avatar
                },
                "User'd Token Refresher Successfully."
            )
        );
});

// change password

const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
        return res
            .status(401)
            .json(
                new ApiResponse(401, {}, "New Password and confirm Password not same.")
            );
    }

    if (oldPassword === newPassword) {
        return res
            .status(401)
            .json(
                new ApiResponse(401, {}, "Old Password can't same as New Password.")
            );
    }

    const user = await User.findById(req.user?._id || "");

    if (!user) {
        return res.status(404).json(new ApiResponse(404, {}, "Cant find user."));
    }

    const isCurrectPassword = await user.isPasswordCurrect(oldPassword);

    if (!isCurrectPassword) {
        return res
            .status(401)
            .json(new ApiResponse(401, {}, "Incurrect old Password."));
    }

    user.password = newPassword;
    user.lastOnline = Date.now();

    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                userName: user.username,
                uid: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
            },
            "Password changed successfully."
        )
    );
});

// forgot password

const forgotPasswordEmail = asyncHandler(async (req, res) => {

    // take email id

    const { email } = req.body;

    if (!email) {
        return res.status(400).json(
            new ApiResponse(
                400,
                {},
                "Email not given."
            )
        )
    }

    // is that email exist in db

    const user = await User.findOne({
        email: email
    });

    if (!user) {
        return res.status(404).json(
            new ApiResponse(
                404,
                {},
                "User don't exits with is email id."
            )
        )
    }


    // genaret a token for forgot password with 15 min exparation time

    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";

    for (let i = 0; i < 25; i++) {
        token += characters.charAt(
            Math.floor(Math.random() * characters.length)
        );
    }

    // save token in db

    const preForgotPassword = await ForgotPassword.findOne({
        owner: user._id
    });

    if (preForgotPassword) {

        preForgotPassword.token = token;
        preForgotPassword.expire = new Date(Date.now() + 15 * 60 * 1000);

        await preForgotPassword.save();
    } else {
        await ForgotPassword.create(
            {
                owner: user._id,
                token: token,
                expire: new Date(Date.now() + 15 * 60 * 1000)
            }
        );
    }



    // send a magic link with that token

    await sendForgotPassword(user.email, token, user._id);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Email send to your email id."
            )
        )
})

const forgotPassword = asyncHandler(async (req, res) => {

    // take token, userId, new password

    const { token, uId, newPassword } = req.body;

    // check is user exist

    if (!mongoose.isValidObjectId(uId)) {
        return res.status(400).json(
            new ApiResponse(
                400,
                {},
                "User Id not given properly."
            )
        )
    }

    const user = await User.findById(uId);

    if (!user) {
        return res.status(404).json(
            new ApiResponse(
                404,
                {},
                "User don't exist."
            )
        )
    }

    // token validation[expair,same]

    const forgotPasswordData = await ForgotPassword.findOne({
        owner: user._id,
    });

    if (!forgotPasswordData) {
        return res.status(400).json(
            new ApiResponse(
                400,
                {},
                "Try to resending Forgot Password email again."
            )
        )
    }

    if (token !== forgotPasswordData.token) {
        return res.status(403).json(
            new ApiResponse(
                403,
                {},
                "Token dose not match."
            )
        )
    }

    if (Date.now() > forgotPasswordData.expire) {
        return res.status(403).json(
            new ApiResponse(
                403,
                {},
                "Token Expies, try after resending email."
            )
        )
    }

    const isSameAsOldPassword = await user.isPasswordCurrect(newPassword);

    if (isSameAsOldPassword) {
        return res.status(401).json(
            new ApiResponse(
                401,
                {},
                "Old password can't be your new Password."
            )
        )
    }

    // set new password

    user.password = newPassword;
    user.lastOnline = Date.now();

    await user.save({ validateBeforeSave: false });

    await forgotPasswordData.deleteOne();

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Password changes succesfully."
            )
        )
})

// geting current login user

const getCurrentUser = asyncHandler(async (req, res) => {

    // aggregate pipeline
    const channal = await User.aggregate([

        //find user with channal with userName
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        //get all subscriberes
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channal",
                as: "subscriberes"
            }
        },
        // get all channal when channalUserName subscribed to
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribto"
            }
        },
        // find is current user subscibed or not and add 3 new filds
        {
            $addFields: {
                // count of subscriberes
                subscriberes: {
                    $size: "$subscriberes"
                },
                // count of subscribed channales/user
                subscribto: {
                    $size: "$subscribto"
                },
                // find is current user subscribed to channalUserName
                isSubscribed: {
                    $cond: {
                        if: { $in: [(req.user._id || "none"), "$subscriberes.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        //getting which filds are needed
        {
            $project: {
                avatar: 1,
                bg: 1,
                firstName: 1,
                lastName: 1,
                username: 1,
                bio: 1,
                isEmailVerified: 1,
                subscriberes: 1,
                subscribto: 1,
                isSubscribed: 1,
                createdAt: 1,
            }
        }
    ]);

    if (!channal[0]) {
        return res.status(404).json(
            new ApiResponse(404,
                {},
                `Can't found User details Try after login again.`
            )
        )
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                user: channal[0],
            },
            "Current user fetched successfully."
        )
    );
});

// update user info

const updateCurrentUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, bio } = req.body;

    const user = await User.findById(req.user._id || "");

    if (!user) {
        return res
            .status(401)
            .json(
                new ApiResponse(401, {}, "Can't find user, try after login again.")
            );
    }

    if (!firstName && !lastName && !bio) {
        return res
            .status(401)
            .json(new ApiResponse(401, {}, "All filds are empty."));
    }

    if (firstName) {
        user.firstName = firstName;
    }
    if (lastName) {
        user.lastName = lastName;
    }

    if (bio) {
        user.bio = bio;
    }

    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                userName: user.username,
                uid: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                bio: user.bio
            },
            "New details updated successfully."
        )
    );
});

// update avatar

const updateAvatar = asyncHandler(async (req, res) => {
    try {
        const avatar = req.files?.avatar ? req.files?.avatar[0] : null;
        const bg = req.files?.bg ? req.files?.bg[0] : null;

        if (!avatar && !bg) {
            return res
                .status(401)
                .json(new ApiResponse(401, {}, "No image given."));
        }

        const user = await User.findById(req.user?._id || "");

        if (!user) {
            deleteLocalFiles([avatar?.path]);

            return res
                .status(404)
                .json(
                    new ApiResponse(404, {}, "Can't find user, try after login again.")
                );
        }

        const avatarLocalPath = avatar?.path || "";
        const bgLocalPath = bg?.path || "";

        if (avatarLocalPath !== "") {
            if (!String(avatar?.mimetype).includes("image/")) {
                deleteLocalFiles([avatar?.path]);
                return res
                    .status(400)
                    .json(
                        new ApiResponse(400, {}, "Avatar image must be in image format.")
                    );
            }

            const progressCallback = (progress) => { };

            // upload avater image on s3
            let s3Response = await uploadFileS3(
                avatarLocalPath,
                `uid-avatar${user._id}${path.extname(avatar.filename)}`,
                progressCallback
            );

            // delete old image if its exist
            if (!user.avatar === "") {
                await deleteS3PublicImageFile((user.avatar).replace(`https://s3.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_S3_PUBLIC_IMAGE_BUCKET_NAME}/`, ''))
            }

            if (!s3Response) {
                return res
                    .status(500)
                    .json(
                        new ApiResponse(
                            500,
                            {},
                            "Somthing went wrong while upload Avatar, try after some time."
                        )
                    );
            }

        }

        if (bgLocalPath !== "") {
            if (!String(bg?.mimetype).includes("image/")) {
                deleteLocalFiles([bg?.path]);
                return res
                    .status(400)
                    .json(
                        new ApiResponse(400, {}, "Background image must be in image format.")
                    );
            }

            const progressCallback = (progress) => { };

            // upload avater image on s3
            let s3Response = await uploadFileS3(
                bgLocalPath,
                `uid-bg${user._id}${path.extname(bg.filename)}`,
                progressCallback
            );

            // delete old image if its exist
            if (!user.avatar === "") {
                await deleteS3PublicImageFile((user.bg).replace(`https://s3.${process.env.AWS_REGION}.amazonaws.com/${process.env.AWS_S3_PUBLIC_IMAGE_BUCKET_NAME}/`, ''))
            }

            if (!s3Response) {
                return res
                    .status(500)
                    .json(
                        new ApiResponse(
                            500,
                            {},
                            "Somthing went wrong while upload backround, try after some time."
                        )
                    );
            }
        }


        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    userName: user.username,
                    uid: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                },
                "Image uploaded."
            )
        );
    } catch (error) {
        deleteLocalFiles([req.files?.avatar[0]?.path,req.files?.bg[0]]);
        return res
            .status(500)
            .json(
                new ApiResponse(
                    500,
                    {},
                    "Somthing went wrong while updateing Avater, try after some time or contact website owner."
                )
            );
    }
});

// channel

const getChannal = asyncHandler(async (req, res) => {

    const channalUserName = req.query?.username || "";

    if (!channalUserName || String(channalUserName).trim().length < 1) {

        return res.status(401).json(
            new ApiResponse(
                401,
                {},
                "Channal Username not given not given properly."
            )
        )
    }

    // aggregate pipeline
    const channal = await User.aggregate([

        //find user with channal with userName
        {
            $match: {
                username: channalUserName
            }
        },
        //get all subscriberes
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channal",
                as: "subscriberes"
            }
        },
        // get all channal when channalUserName subscribed to
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribto"
            }
        },
        // find is current user subscibed or not and add 3 new filds
        {
            $addFields: {
                // count of subscriberes
                subscriberes: {
                    $size: "$subscriberes"
                },
                // count of subscribed channales/user
                subscribto: {
                    $size: "$subscribto"
                },
                // find is current user subscribed to channalUserName
                isSubscribed: {
                    $cond: {
                        if: { $in: [(req.user._id || "none"), "$subscriberes.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        //getting which filds are needed
        {
            $project: {
                avatar: 1,
                bg: 1,
                firstName: 1,
                lastName: 1,
                username: 1,
                bio: 1,
                subscriberes: 1,
                subscribto: 1,
                isSubscribed: 1,
                createdAt: 1,
            }
        }
    ]);

    if (!channal[0]) {
        return res.status(404).json(
            new ApiResponse(404,
                {},
                `Can't found channal ${channalUserName}.`
            )
        )
    }

    return res.status(200).json(
        new ApiResponse(200,
            {
                channal: channal[0]
            },
            `${channalUserName} information fatched.`
        )
    )
});


export {
    registerUser,
    loginUser,
    verifyEmail,
    incomingRefreshToken,
    logOut,
    forgotPasswordEmail,
    forgotPassword,
    changePassword,
    getCurrentUser,
    updateCurrentUser,
    updateAvatar,
    getChannal
};
