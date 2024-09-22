import { User } from "../models/user.models.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendVerificationEmail } from "../utils/mails.js";

import jwt from "jsonwebtoken"



const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


// httpcokie
const cookieOption = {
    httpOnly: true,
    secure: true
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
};

// register new user


const registerUser = asyncHandler(async (req, res) => {

    const {
        firstName,
        lastName,
        username,
        email,
        password } = req.body;


    if ([firstName, lastName, email, username, password].some((fild) =>
        String(fild).trim().length < 1
    )) {

        return res.status(400).json(
            new ApiResponse(400, {}, "All Filds are Require.")
        )
    }

    if (!emailRegex.test(email)) {
        return res.status(400).json(
            new ApiResponse(400, {}, "Invalid email address.")
        )
    }

    // cheack user exist with username or email yes{return user exist} no{next}

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existedUser) {
        return res.status(409).json(
            new ApiResponse(409, {}, "User with username or email already exist.")
        )
    }

    // genaret email varify token

    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let emailVerificationToken = '';

    const charactersLength = characters.length;

    for (let i = 0; i < 20; i++) {
        emailVerificationToken += characters.charAt(Math.floor(Math.random() * charactersLength));
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
        return res.status(500).json(
            new ApiResponse(500, {}, "Somthing want wrong while registering new user.")
        )
    }

    // sent varification email to email address

    const mailRes = await sendVerificationEmail(email, emailVerificationToken, newUser._id);

    // give response

    return res.status(201).json(
        new ApiResponse(200, newUser, "User Registered sccess fully.")
    )
});



// email verify

const verifyEmail = asyncHandler(async (req, res) => {

    const token = req.query.token;
    const uId = req.query.uId;

    if (!token || String(token).length < 10) {
        return res.status(400).json(
            new ApiResponse(
                400,
                {},
                "Token not given."
            )
        )
    }

    if (!uId || String(uId).length < 10) {
        return res.status(400).json(
            new ApiResponse(
                400,
                {},
                "Uid not given."
            )
        )
    }

    const user = await User.findById(uId);

    if (!user) {
        return res.status(404).json(
            new ApiResponse(
                404,
                {},
                "User not found."
            )
        )
    }

    const isSameToken = user.emailVerificationToken === token;

    if (!isSameToken) {
        return res.status(400).json(
            new ApiResponse(
                400,
                {},
                "Token is not correct."
            )
        )
    }

    user.isEmailVerified = true;

    await user.save();

    return res.status(200).json(
        new ApiResponse(
            200,
            {},
            "Email verify succesfully."
        )
    )
});


// login user

const loginUser = asyncHandler(async (req, res) => {
    
    //get username / email and password

    const { username, password } = req.body

    //validate username / email and password

    if (!username || !password) {
        
        return res
            .status(400)
            .json(
                new ApiResponse(400,
                    "Username/Email or Password not given properly."
                )
            );
    }

    if (
        [username, password].some((fild) => String(fild).trim().length < 1)
    ) {

        return res
            .status(400)
            .json(
                new ApiResponse(400,
                    "Username/Email or Password not given properly."
                )
            );
    }


    //user exist with username or email

    const user = await User.findOne({
        $or: [{ username: username }, { email: username }]
    });

    if (!user) {
        return res
            .status(404)
            .json(
                new ApiResponse(404,
                    "User do not exist."
                )
            );
    }

    //check password

    const isPasswordValid = await user.isPasswordCurrect(password);

    if (!isPasswordValid) {
        
        return res
            .status(401)
            .json(
                new ApiResponse(401,
                    "Password incorrect."
                )
            );
    }


    //genarete tokens

    const { accesToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id);

    //send token cookices
    

    return res
        .status(200)
        .cookie("accesToken", accesToken, cookieOption)
        .cookie("refreshToken", refreshToken, cookieOption)
        .json(
            new ApiResponse(200,
                {
                    userName: user.username,
                },
                "User Login Successfully."
            )
        );
});

// logout



// refreshTokens

const incomingRefreshToken = asyncHandler(async (req, res) => {

    const token = req.cookies?.refreshToken || req.body?.refreshToken || "";

    if (token.length < 1) {
        return res
        .status(401)
        .json(
            new ApiResponse(401,
                "You dont have RefreshToken, try to login again."
            )
        );
    }

    // decoding token

    const decodedToken = await jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);


    // validating

    if (!decodedToken) {
        return res
        .status(401)
        .json(
            new ApiResponse(401,
                "Invalid refeshToken, try to login again."
            )
        );
    }

    const user = await User.findById(decodedToken?.uid || "").select(
        "-password "
    );

    if (!user) {
        return res
        .status(401)
        .json(
            new ApiResponse(401,
                "Invalid refeshToken , try to login again."
            )
        );
    }


    if (token !== user.refreshToken) {
        return res
        .status(401)
        .json(
            new ApiResponse(401,
                "RefreshToken expired or using old token, try to login again."
            )
        );
    }

    // generate new tokens

    const { accesToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id);

    //send token cookices

    return res
        .status(200)
        .cookie("accesToken", accesToken, cookieOption)
        .cookie("refreshToken", refreshToken, cookieOption)
        .json(
            new ApiResponse(200,
                {
                    userName: user.username,
                    uid:user._id,
                    firstName:user.firstName,
                    lastName:user.lastName
                },
                "User'd Token Refresher Successfully."
            )
        );


});


// change password



// forgot password



// geting current login user



// update user info



export {
    registerUser,
    loginUser,
    verifyEmail,
    incomingRefreshToken
};