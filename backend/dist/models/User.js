import mongoose, { Schema } from 'mongoose';
const UserSchema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: '' },
    createdAt: { type: String, required: true }
}, {
    timestamps: false,
    toJSON: {
        transform: (doc, ret) => {
            const cleanRet = ret;
            delete cleanRet._id;
            delete cleanRet.__v;
            delete cleanRet.password;
            return cleanRet;
        }
    }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);
export default User;
