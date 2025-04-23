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
const INDEX_NAME = 'cafb';

// Sample data for relevant documents
const SAMPLE_DOCUMENTS = [
  {
    id: 'doc1',
    score: 0.89,
    metadata: {
      title: 'Food Distribution Programs',
      content: 'The Capital Area Food Bank operates several distribution programs to serve communities in need. Our main programs include the Family Market Program, which provides fresh produce and healthy groceries to families, and the Senior Brown Bag Program, which delivers nutritious food to seniors with limited mobility.'
    }
  },
  {
    id: 'doc2',
    score: 0.85,
    metadata: {
      title: 'Volunteer Opportunities',
      content: 'Volunteers are essential to our mission. Opportunities include sorting and packing food donations, assisting at distribution events, delivering meals to seniors, and providing administrative support. Group volunteering is available for corporate teams, schools, and community organizations.'
    }
  },
  {
    id: 'doc3',
    score: 0.78,
    metadata: {
      title: 'Nutrition Education',
      content: 'Our nutrition education programs teach families how to prepare healthy meals on a budget. We offer cooking demonstrations, grocery shopping tours, and workshops on meal planning. These programs help communities make healthier food choices and prevent diet-related health conditions.'
    }
  },
  {
    id: 'doc4',
    score: 0.75,
    metadata: {
      title: 'Partner Agency Network',
      content: 'The Capital Area Food Bank partners with over 450 nonprofit organizations to distribute food throughout the region. Our partner agencies include food pantries, soup kitchens, shelters, and community centers that directly serve people facing hunger in their neighborhoods.'
    }
  },
  {
    id: 'doc5',
    score: 0.71,
    metadata: {
      title: 'Donation Guidelines',
      content: 'We accept donations of non-perishable food items, fresh produce, and monetary contributions. The most needed items include canned proteins, grains, and shelf-stable milk. Financial donations allow us to purchase food in bulk at reduced costs, maximizing the impact of your contribution.'
    }
  }
];

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
async function queryPinecone(query, topK = 5, useSampleData = true) {
  if (useSampleData) {
    console.log(`Using sample data for query: "${query}"`);
    return SAMPLE_DOCUMENTS.slice(0, topK);
  }
  
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
async function getDocumentById(docId, useSampleData = true) {
  if (useSampleData) {
    const document = SAMPLE_DOCUMENTS.find(doc => doc.id === docId);
    if (document) {
      return document;
    } else {
      throw new Error(`Sample document with ID ${docId} not found`);
    }
  }
  
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
async function getContextFromDocuments(documentIds, useSampleData = true) {
  if (!documentIds || documentIds.length === 0) {
    return '';
  }
  
  try {
    const documents = await Promise.all(
      documentIds.map(async (docId) => {
        try {
          return await getDocumentById(docId, useSampleData);
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