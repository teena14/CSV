import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/csv_importer';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ MongoDB connected:', MONGODB_URI);
  } catch (error) {
    console.error('❌ MongoDB connection failed. Please ensure MongoDB is running.');
    console.error('   URI:', MONGODB_URI);
    console.error('   Error:', (error as Error).message);
    console.warn('⚠️  Server starting without database — some features will not work.');
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  console.log('🔌 MongoDB disconnected');
}
