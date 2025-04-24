const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Define index name - make sure this matches the one in pinecone.js
const INDEX_NAME = 'cafbai';

// Sample CABF documents to upload
const sampleDocuments = [
  {
    id: 'doc1',
    title: 'Capital Area Food Bank Grant Proposal',
    content: 'The Capital Area Food Bank has been serving the DC metro area for over 40 years. Our mission is to address hunger today and build healthier futures tomorrow for residents struggling with food insecurity. We provide food assistance to over 400,000 individuals through a network of 450+ nonprofit partners and direct distribution programs. Our approach combines emergency food access with nutrition education and community partnerships to create long-term solutions to hunger.',
    type: 'grant_proposal',
    url: 'https://example.com/cabf-grant-1'
  },
  {
    id: 'doc2',
    title: 'CABF Community Impact Report 2023',
    content: 'In 2023, the Capital Area Food Bank distributed over 45 million meals to families facing food insecurity across Washington DC, Maryland, and Virginia. Our programs reached more than 400,000 individuals, including 120,000 children and 75,000 seniors. We expanded our mobile market program by 30%, reaching previously underserved communities. Through our Hunger Lifeline, we connected 12,000 callers to emergency food assistance and benefits enrollment services. Our nutrition education programs trained 5,000 community members in healthy cooking on a budget.',
    type: 'impact_report',
    url: 'https://example.com/cabf-impact-2023'
  },
  {
    id: 'doc3',
    title: 'Food Insecurity in the DMV Region: Research Study',
    content: 'Food insecurity affects over 400,000 residents in the DC, Maryland, and Virginia region, with particularly high rates among children and seniors. Economic challenges from inflation have increased need by 30%. Black and Hispanic households experience food insecurity at three times the rate of white households in the region. Housing costs represent the largest expense for food-insecure families, often forcing difficult choices between paying rent and purchasing food. The study identifies transportation access as a major barrier to food security in suburban and rural areas of the DMV.',
    type: 'research',
    url: 'https://example.com/cabf-research-dmv'
  },
  {
    id: 'doc4',
    title: 'CABF Nutrition Education Program',
    content: 'The Capital Area Food Bank\'s nutrition education program provides resources and workshops to help families prepare healthy meals on a budget. Our Cooking Matters courses teach practical nutrition information, food budgeting, and cooking skills over a six-week period. The Healthy Pantry program works with partner agencies to increase the nutritional quality of food distributed. Our dietitians have created over 100 affordable, culturally appropriate recipes using ingredients commonly available at our partner pantries. Digital learning resources include video cooking demonstrations, meal planning tools, and an interactive grocery budgeting calculator.',
    type: 'program_description',
    url: 'https://example.com/cabf-nutrition'
  },
  {
    id: 'doc5',
    title: 'Emergency Food Assistance Program Guidelines',
    content: 'The Emergency Food Assistance Program (TEFAP) provides food to low-income individuals through our network of partner agencies. Eligibility is determined based on household income and size. Participants must reside in the service area of the distribution site and meet income requirements (typically 185% of the federal poverty level). Required documentation includes proof of address and household size. Distribution sites include food pantries, soup kitchens, and community centers throughout the DMV region. The program provides nutritionally balanced food packages containing protein, grains, fruits, vegetables, and dairy items when available.',
    type: 'program_guidelines',
    url: 'https://example.com/cabf-tefap'
  }
];

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

// Function to upload documents to Pinecone
async function uploadDocuments() {
  try {
    console.log('Starting upload of sample documents to Pinecone...');
    
    // Connect to Pinecone index
    const index = pinecone.Index(INDEX_NAME);
    
    // Process and upload each document
    for (const doc of sampleDocuments) {
      try {
        console.log(`Processing document: ${doc.title}`);
        
        // Combine title and content for embedding
        const textToEmbed = `${doc.title} ${doc.content}`;
        
        // Generate embedding vector for the document
        const embedding = await generateEmbedding(textToEmbed);
        
        // Prepare record for Pinecone
        const record = {
          id: doc.id,
          values: embedding,
          metadata: {
            title: doc.title,
            content: doc.content,
            type: doc.type,
            url: doc.url
          }
        };
        
        // Upsert the record to Pinecone
        await index.upsert([record]);
        console.log(`Successfully uploaded: ${doc.title}`);
      } catch (error) {
        console.error(`Error processing document ${doc.title}:`, error);
      }
    }
    
    console.log('Upload complete! Sample documents are now available in your Pinecone index.');
  } catch (error) {
    console.error('Error uploading documents:', error);
  }
}

// Execute the upload
uploadDocuments()
  .then(() => {
    console.log('Script execution completed.');
  })
  .catch(error => {
    console.error('Script failed:', error);
  }); 