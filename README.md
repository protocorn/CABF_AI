# AI Document Generator with Pinecone Integration

This application allows you to generate various types of documents (including grant proposals, PDFs, DOCX, presentations, and social media content) using Google's Gemini AI. It also includes a Pinecone vector database integration to search and use relevant documents as context for more accurate content generation.

## Features

- Generate various document types (grant proposals, PDFs, DOCX, presentations)
- Search relevant documents in the Capital Area Food Bank (CABF) vector database
- Use retrieved documents as context for more accurate document generation
- Edit generated content with AI assistance
- Export documents in various formats

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Google Gemini API key
- Pinecone API key
- Pinecone index setup with 512 dimensions

## Installation

1. Clone the repository
```bash
git clone <repository-url>
cd ai-document-generator
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file based on the example
```bash
cp .env.example .env
```

4. Add your API keys to the `.env` file
```
GEMINI_API_KEY=your_gemini_api_key
PINECONE_API_KEY=your_pinecone_api_key
PORT=3030
```

## Pinecone Setup

1. Create a Pinecone account at [pinecone.io](https://www.pinecone.io)
2. Create a new index with the following configuration:
   - Name: `cabf-docs` (or update the INDEX_NAME constant in src/pinecone.js)
   - Dimensions: 512
   - Metric: cosine
   - Pod Type: starter or higher

3. Upload sample documents to your index using the provided script:
   ```bash
   npm run upload-samples
   ```
   This will populate your Pinecone index with sample Capital Area Food Bank documents for testing.

## Running the Application

### Development mode
```bash
npm run dev
```

### Production mode
```bash
npm start
```

The application will be available at `http://localhost:3030` (or whatever PORT you specified in the .env file).

## Usage

1. **Generate Documents**:
   - Select output format (PDF, DOCX, PowerPoint, Grant Proposal, etc.)
   - Enter your query
   - Click "Generate Document"

2. **Search Documents**:
   - Go to the "Search Documents" tab
   - Enter your search query
   - Click "Search Documents"
   - Select relevant documents
   - Click "Use Selected Documents for Generation"
   - Go back to the Generate tab to create a document with this context

3. **Edit Generated Content**:
   - Click "Edit Content" on a generated document
   - Modify fields manually or use AI-assisted editing

## Troubleshooting

### Dimension Mismatch
If you encounter dimension mismatch errors with Pinecone, ensure your index is configured with 512 dimensions to match the processed embeddings from the Gemini API.

### API Key Issues
- For Gemini API: Make sure you have enabled the Gemini API in your Google Cloud account
- For Pinecone: Verify the API key has proper permissions for the index

## License

[MIT](LICENSE) 