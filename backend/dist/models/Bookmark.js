import mongoose, { Schema } from 'mongoose';
const BookmarkSchema = new Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    group: { type: String, required: true, default: 'Unsorted' },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true }
}, {
    toJSON: {
        transform: (doc, ret) => {
            const cleanRet = ret;
            delete cleanRet._id;
            delete cleanRet.__v;
            return cleanRet;
        }
    }
});
BookmarkSchema.index({ userId: 1, group: 1, createdAt: 1 });
const Bookmark = mongoose.models.Bookmark || mongoose.model('Bookmark', BookmarkSchema);
export default Bookmark;
