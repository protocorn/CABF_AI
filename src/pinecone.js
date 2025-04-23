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

async function generateEmbedding(text) {
  try {
    const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
    const result = await embeddingModel.embedContent(text);
    const embedding = result.embedding.values;

    // Resize and normalize to 512 dimensions
    const resized = embedding.slice(0, 512);
    const magnitude = Math.sqrt(resized.reduce((sum, val) => sum + val * val, 0));
    return resized.map(val => val / magnitude);
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Function to query Pinecone for relevant documents

// Function to calculate cosine similarity
function cosineSimilarity(vectorA, vectorB) {
  const dotProduct = vectorA.reduce((sum, val, i) => sum + val * vectorB[i], 0);
  const magnitudeA = Math.sqrt(vectorA.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(vectorB.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Function to query Pinecone for relevant content
async function queryPinecone(query, topK = 5) {
  try {
    const index = await getPineconeIndex();

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    console.log('Query Embedding:', queryEmbedding);

    // Query Pinecone for documents with type: document
    const queryResponse = await index.query({
      topK,
      includeMetadata: true,
      vector: queryEmbedding,
      filter: { type: 'document' }, // Filter to include only documents
    });
    console.log('Query Response:', queryResponse);

    const matches = queryResponse.matches || [];
    console.log('Matches:', matches);

    // Filter matches by valid embeddings
    const validMatches = matches.filter(match => match.values && match.values.length > 0);
    console.log('Valid Matches:', validMatches);

    // Calculate cosine similarity for each match
    const resultsWithSimilarity = validMatches.map(match => {
      const similarity = cosineSimilarity(queryEmbedding, match.values || []);
      return {
        id: match.id,
        score: match.score,
        similarity,
        metadata: match.metadata,
      };
    });

    // Sort results by similarity in descending order
    const sortedResults = resultsWithSimilarity.sort((a, b) => b.similarity - a.similarity);

    console.log('Sorted Results:', sortedResults);

    // Return the top results
    return sortedResults.slice(0, topK);
  } catch (error) {
    console.error('Error querying Pinecone:', error);
    throw error;
  }
}

async function fetchPineconeData(query, contentTypeFilter = null) {
  try {
    const response = await fetch('/api/query-pinecone', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, topK: 5, contentTypeFilter }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch data from Pinecone');
    }

    const data = await response.json();
    console.log('Pinecone data:', data);
    return data.results;
  } catch (error) {
    console.error('Error fetching Pinecone data:', error);
    return [];
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
      const title = doc.metadata?.title || `Document ${index + 1}`;
      const content = doc.metadata?.content || doc.metadata?.text_excerpt || '';
      context += `DOCUMENT ${index + 1}: ${title}\n${content}\n\n`;
    });

    return context;
  } catch (error) {
    console.error('Error getting context:', error);
    return '';
  }
}

module.exports = {
  queryPinecone,
  getContextFromDocuments
};
