# GrowEasy CRM - AI-Powered CSV Importer

An intelligent, production-ready full-stack application that seamlessly imports CSV leads from any source, maps headers dynamically, extracts standard CRM fields, and standardizes data using Large Language Models (LLMs).

Built for GrowEasy CRM to eliminate manual mapping and ensure high-quality lead ingestion.

## Features

- **Schema-Agnostic Uploads**: Accept CSVs from Facebook, Google Ads, Excel, custom spreadsheets, or any arbitrary format. No predefined headers required.
- **AI Data Extraction**: Intelligently extracts names, standardizes phone numbers (with country codes), classifies leads, and normalizes unstructured fields.
- **Robust Model Fallback Chain**: Designed for resilience. Automatically falls back across multiple AI models (Gemini 2.5 Pro → Gemini 2.5 Flash → GPT-4o-mini → GPT-4o) if one rate-limits or fails.
- **Streaming & Batching**: UI features live processing with progress bars and dynamic result updating.
- **Visual Feedback**: Granular success and failure tabs with detailed skipped-reason reporting.
- **Export Data**: Easily export successfully imported CRM records back into CSV for ingestion or audit.
- **Dark Mode Support**: Aesthetic UI complete with Light/Dark mode toggles and modern design semantics.

## Tech Stack

### Frontend
- Next.js (Pages Router)
- React 18
- Vanilla CSS (with modern CSS Variables token system)
- TypeScript

### Backend
- Node.js & Express
- MongoDB (via Mongoose)
- TypeScript
- `csv-parse` for resilient string parsing
- `@google/generative-ai` & `openai` SDKs for AI extraction

## Architecture Overview

The system is split into a Next.js frontend running on port 3000 and an Express backend running on port 4000. 

1. **Upload Phase**: The client uploads a CSV. Multer safely ingests up to 10MB into memory. The CSV is parsed into JSON, saved into a temporary `ImportSession` in MongoDB, and the top 10 rows are returned to the client as a preview.
2. **AI Extraction Phase (Batching)**: Upon confirmation, the backend slices the CSV rows into batches of 10 to manage AI token constraints. The application then streams progress updates via an HTTP polling endpoint back to the client.
3. **Multi-Model Orchestration**: For each batch, the AI is prompted to classify and normalize the input. If a model throws a `429 Too Many Requests`, the service immediately falls back to the next available model in the chain.

## How AI Extraction Works

Instead of strict column name matching, the AI prompt looks at both the **header** and the **underlying row data**. This semantic extraction allows the AI to realize that a column named "Information" containing phone numbers should be mapped to the CRM's `mobile_without_country_code` field.

The model is explicitly instructed on status priorities (e.g. `SALE_DONE > BAD_LEAD`) ensuring that if a customer expressed interest but their final note states "Fake number", the system classifies the outcome appropriately.

## Installation & Setup

### Prerequisites
- Node.js (v18+)
- MongoDB instance (local or Atlas)

### 1. Clone & Install Dependencies
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

### 2. Environment Variables
#### Backend (`backend/.env`)
Create a `.env` file in the `backend/` directory:
```env
PORT=4000
FRONTEND_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/csv_importer
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
```

#### Frontend (`frontend/.env.local`)
Create a `.env.local` file in the `frontend/` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Running Locally
Run the frontend and backend concurrently in separate terminal windows.

**Backend**
```bash
cd backend
npm run dev
```

**Frontend**
```bash
cd frontend
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## Design Decisions & Trade-offs

- **Polling vs. WebSockets**: Given the batch processing nature, polling via a custom `useImportPolling` hook (1s interval) was chosen for architectural simplicity over managing WebSocket connections. It easily handles momentary disconnects gracefully.
- **In-Memory Buffer & Storage Limits**: `multer` restricts memory limits to 10MB, which comfortably covers standard CRM exports. `ImportSession.ts` stores the `rawRows` array in MongoDB during the preview stage. 
  - *Limitation*: MongoDB enforces a strict 16MB BSON document limit. A 10MB CSV with headers could parse into 20MB of JSON, breaking the DB insert. This take-home scales perfectly for the batch sizes requested, but a full production app handling 500k+ row CSVs would stream raw buffers directly to AWS S3 or MongoDB GridFS and parse in chunks rather than holding `rawRows` in the document.
- **Vanilla CSS**: We intentionally bypassed Tailwind CSS for standard Semantic CSS Tokens to ensure maximum design consistency and keep component classes incredibly clean.
- **Centralized Error Handling**: We utilized a custom `AppError` utility class on the backend, converting unpredictable generic JS errors into exact HTTP Status Codes, improving reliability over brittle string checks.

## Known Limitations & Future Improvements

1. **Large CSV Support**: Transition away from in-document session persistence (`rawRows`) towards cloud object storage for CSV buffers larger than 10MB.
2. **Authentication**: Wrap backend routes in robust JWT or session-based API auth layers to prevent unauthorized data uploads.
3. **Queueing System**: Integrate Redis & BullMQ to offload processing entirely from the standard Express Request/Response cycle for highly concurrent usage.
