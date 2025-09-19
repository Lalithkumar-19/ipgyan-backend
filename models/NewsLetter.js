import { Schema, model } from "mongoose";

const NewsLetterSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    }
})


const NewsLetter = model("NewsLetter", NewsLetterSchema);
export default NewsLetter;
