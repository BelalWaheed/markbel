import mongoose, { Schema } from 'mongoose';
const PushSubscriptionSchema = new Schema({
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    endpoint: { type: String, required: true },
    keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
    },
    deviceLabel: { type: String, default: '' },
    createdAt: { type: String, required: true }
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
PushSubscriptionSchema.index({ userId: 1, endpoint: 1 });
const PushSubscription = mongoose.models.PushSubscription || mongoose.model('PushSubscription', PushSubscriptionSchema);
export default PushSubscription;
