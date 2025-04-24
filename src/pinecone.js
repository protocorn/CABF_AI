const axios = require('axios');

// Configure Flask service URL for Pinecone operations
const FLASK_SERVICE_URL = process.env.FLASK_SERVICE_URL || 'http://localhost:5000';

/**
 * Query Pinecone for documents via the Flask service
 * @param {string} query - The search query text
 * @param {number} topK - Number of results to return
 * @param {boolean} useSampleData - Flag to use sample data (not used, maintained for compatibility)
 * @returns {Promise<Array>} - Array of document results
 */
async function queryPinecone(query, topK = 10, useSampleData = false) {
  try {
    console.log(`Querying Pinecone via Flask service: "${query}"`);
    
    // Call the Flask service's query-pinecone endpoint
    const response = await axios.post(`${FLASK_SERVICE_URL}/query-pinecone`, {
      query,
      topK,
      contentType: 'document'
    });
    
    if (!response.data || !response.data.results) {
      console.warn('No results returned from Pinecone service');
      return [];
    }
    
    // Process and format the results to match the expected format
    const documents = response.data.results.map(result => {
      return {
        id: result.id,
        score: result.score,
        title: result.metadata?.title || 'Untitled',
        content: result.metadata?.content || '',
        url: result.metadata?.url || '',
        type: result.metadata?.type || 'document'
      };
    });
    
    console.log(`Received ${documents.length} results from Pinecone service`);
    return documents;
  } catch (error) {
    console.error('Error querying Pinecone via Flask service:', error.message);
    
    // Throw error instead of returning sample data
    throw new Error(`Failed to query Pinecone: ${error.message}`);
  }
}

/**
 * Extract context from documents for AI generation
 * @param {Array} documents - Array of documents to extract context from
 * @param {number} maxChars - Maximum number of characters to include
 * @returns {string} - Formatted context for AI prompts
 */
function getContextFromDocuments(documents, maxChars = 3000) {
  if (!documents || documents.length === 0) {
    return '';
  }
  
  let context = 'RELEVANT CONTEXT:\n\n';
  let charCount = context.length;
  
  for (const doc of documents) {
    if (!doc.content) continue;
    
    const docText = `DOCUMENT: ${doc.title || 'Untitled'}\n${doc.content}\n\n`;
    
    // Check if adding this document would exceed the max character limit
    if (charCount + docText.length > maxChars) {
      // If we're about to exceed, truncate the document to fit
      const remainingChars = maxChars - charCount;
      if (remainingChars > 100) { // Only add if we can include a meaningful chunk
        context += `DOCUMENT: ${doc.title || 'Untitled'}\n${doc.content.substring(0, remainingChars - 50)}...\n\n`;
      }
      break;
    }
    
    context += docText;
    charCount += docText.length;
  }
  
  return context;
}

module.exports = {
  queryPinecone,
  getContextFromDocuments
}; 