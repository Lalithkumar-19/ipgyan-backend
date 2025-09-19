import { Schema, model } from "mongoose";

const ContactSchema=new Schema({
    fullname:{type:String,required:true},
    email:{type:String,required:true},
    subject:{type:String,required:true},
    message:{type:String,required:true} ,
    phone:{type:String,required:true}
})