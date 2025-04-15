const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// The name of the index where CABF documents are stored
const INDEX_NAME = 'cabf-docs';

// Function to initialize Pinecone client and get the index
async function getPineconeIndex() {
  try {
    const index = pinecone.Index(INDEX_NAME);
    return index;
  } catch (error) {
    console.error('Error initializing Pinecone index:', error);
    throw error;
  }
}

// Function to query Pinecone for relevant documents
async function queryPinecone(query, topK = 5) {
  try {
    const index = await getPineconeIndex();
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Query vectors based on the user's query
    const queryResponse = await index.query({
      topK,
      includeMetadata: true,
      vector: queryEmbedding,
    });

    // Extract and return the documents from the query results
    return queryResponse.matches.map(match => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata,
    }));
  } catch (error) {
    console.error('Error querying Pinecone:', error);
    throw error;
  }
}

// Function to generate embeddings using Google's Gemini API
async function generateEmbedding(text) {
  try {
    // Use the embedding model
    const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
    
    // Generate embedding
    const result = await embeddingModel.embedContent(text);
    const embedding = result.embedding.values;
    
    // Resize from 768 dimensions to 512 dimensions to match Pinecone index
    // Method 1: Simple truncation (take first 512 values)
    const resizedEmbedding = embedding.slice(0, 512);
    
    // Normalize the embedding to unit length to maintain similarity properties
    const magnitude = Math.sqrt(resizedEmbedding.reduce((sum, val) => sum + val * val, 0));
    const normalizedEmbedding = resizedEmbedding.map(val => val / magnitude);
    
    return normalizedEmbedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Function to fetch document content by ID
async function getDocumentById(docId) {
  try {
    const index = await getPineconeIndex();
    const response = await index.fetch([docId]);
    
    if (response.records && response.records[docId]) {
      return response.records[docId];
    } else {
      throw new Error(`Document with ID ${docId} not found`);
    }
  } catch (error) {
    console.error('Error fetching document:', error);
    throw error;
  }
}

// Function to get full context from multiple document IDs
async function getContextFromDocuments(documentIds) {
  if (!documentIds || documentIds.length === 0) {
    return '';
  }
  
  try {
    const documents = await Promise.all(
      documentIds.map(async (docId) => {
        try {
          return await getDocumentById(docId);
        } catch (error) {
          console.error(`Error fetching document ${docId}:`, error);
          return null;
        }
      })
    );
    
    // Filter out any null results and extract content
    const validDocuments = documents.filter(doc => doc !== null);
    
    if (validDocuments.length === 0) {
      return '';
    }
    
    // Combine the content from all documents
    let context = 'Using context from Capital Area Food Bank documents:\n\n';
    
    validDocuments.forEach((doc, index) => {
      if (doc.metadata && doc.metadata.title) {
        context += `DOCUMENT ${index + 1}: ${doc.metadata.title}\n`;
        if (doc.metadata.content) {
          context += `${doc.metadata.content}\n\n`;
        }
      }
    });
    
    return context;
  } catch (error) {
    console.error('Error getting context from documents:', error);
    return '';
  }
}

module.exports = {
  queryPinecone,
  getContextFromDocuments
}; 