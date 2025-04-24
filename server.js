const express = require('express');
const path = require('path');
const fs = require('fs');
// Add dotenv to load environment variables from .env file
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const carbone = require('carbone');
const { queryPinecone, getContextFromDocuments } = require('./src/pinecone');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
// Add axios for making HTTP requests to Flask server
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Gemini API
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.warn('WARNING: No Gemini API key found. Set GEMINI_API_KEY in .env file');
}
const genAI = new GoogleGenerativeAI(API_KEY || 'YOUR_API_KEY_HERE');

// Configure Flask service URL (Python service for Pinecone)
const FLASK_SERVICE_URL = process.env.FLASK_SERVICE_URL || 'http://localhost:5000';

// Setup directory paths using absolute paths
const publicDir = path.join(__dirname, 'public');
const templatesDir = path.join(__dirname, 'templates');

// Debug log the paths
console.log('Current directory:', __dirname);
console.log('Public directory path:', publicDir);
console.log('Templates directory path:', templatesDir);

// Check if directories exist
if (!fs.existsSync(publicDir)) {
  console.error(`ERROR: Public directory not found at ${publicDir}`);
  // Create public directory if it doesn't exist
  try {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log(`Created public directory at ${publicDir}`);
  } catch (err) {
    console.error(`Failed to create public directory: ${err.message}`);
  }
}

if (!fs.existsSync(templatesDir)) {
  console.error(`ERROR: Templates directory not found at ${templatesDir}`);
  // Create templates directory if it doesn't exist
  try {
    fs.mkdirSync(templatesDir, { recursive: true });
    console.log(`Created templates directory at ${templatesDir}`);
  } catch (err) {
    console.error(`Failed to create templates directory: ${err.message}`);
  }
}

// Middleware
app.use(express.static(publicDir));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve index.html for the root route
app.get('/', (req, res) => {
  const indexPath = path.join(publicDir, 'CABF_AI/index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Create a basic index.html if it doesn't exist
    const basicHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Capital Area Food Bank AI</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { color: #004D40; }
          .container { border: 1px solid #ddd; padding: 20px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>Capital Area Food Bank AI Document Generator</h1>
        <div class="container">
          <p>Welcome to the Capital Area Food Bank AI Document Generator.</p>
          <p>This application helps you generate various documents, search through existing content, and create presentations.</p>
          <p>The server is running properly, but the frontend files are missing. Please check the documentation for setup instructions.</p>
        </div>
      </body>
      </html>
    `;
    
    try {
      fs.writeFileSync(indexPath, basicHtml);
      console.log(`Created basic index.html at ${indexPath}`);
      res.sendFile(indexPath);
    } catch (err) {
      console.error(`Failed to create index.html: ${err.message}`);
      res.status(500).send('Error: Could not find or create index.html');
    }
  }
});

// API endpoint for document retrieval from Pinecone
app.post('/api/search-documents', async (req, res) => { 
  try {
    const { query, fileName } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`Processing search query: "${query}"`);
    
    try {
      // Call the new specialized endpoint for document retrieval
      const response = await axios.post(`${FLASK_SERVICE_URL}/query-documents`, {
        query,
        topK: 10
      });
      
      // Check if we got a valid response with documents
      if (response.data && response.data.documents) {
        const documents = response.data.documents;
        console.log(`Returning ${documents.length} search results from Pinecone using specialized document endpoint`);
        res.json({ documents });
      } else {
        console.warn('No documents returned from specialized endpoint, falling back to regular query endpoint');
        
        // Fall back to the original endpoint
        const fallbackResponse = await axios.post(`${FLASK_SERVICE_URL}/query-pinecone`, {
          query,
          topK: 10,
          contentType: 'document'
        });
        
        if (fallbackResponse.data && fallbackResponse.data.results) {
          const documents = fallbackResponse.data.results.map(result => ({
            id: result.id,
            score: result.score,
            metadata: result.metadata,
            title: result.metadata?.title || '',
            content: result.metadata?.text || result.metadata?.content || ''
          }));
          
          console.log(`Returning ${documents.length} search results from fallback endpoint`);
          res.json({ documents });
        } else {
          throw new Error('No documents found in Pinecone database');
        }
      }
    } catch (pineconeError) {
      console.error('Pinecone search failed:', pineconeError);
      return res.status(503).json({ 
        error: 'Failed to connect to Pinecone service', 
        details: pineconeError.message,
        source: 'pinecone'
      });
    }
  } catch (error) {
    console.error('Error in search endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint for generating PowerPoint with template and Pinecone data
app.post('/api/generate-ppt-from-template', async (req, res) => {
  try {
    const { numSlides, query } = req.body;
    
    if (!numSlides || !query) {
      return res.status(400).json({ error: 'Number of slides and query are required' });
    }
    
    console.log(`Generating PowerPoint - Query: "${query}", Slides: ${numSlides}`);
    
    // Initialize empty arrays for data
    let textData = [];
    let imageData = [];
    
    // Try to fetch text data from Flask service
    console.log('Fetching text data from Python service...');
    try {
      const textResponse = await axios.post(`${FLASK_SERVICE_URL}/query-documents`, {
        query,
        topK: Math.min(numSlides * 2, 20)
      });
      
      if (textResponse.data && textResponse.data.documents && textResponse.data.documents.length > 0) {
        textData = textResponse.data.documents;
        console.log(`Found ${textData.length} text items from Pinecone`);
      } else {
        console.log('No text data found in specialized endpoint, trying fallback');
        
        // Try fallback to regular endpoint
        const fallbackResponse = await axios.post(`${FLASK_SERVICE_URL}/query-pinecone`, {
          query,
          topK: Math.min(numSlides * 2, 20),
          contentType: 'document'
        });
        
        if (fallbackResponse.data && fallbackResponse.data.results && fallbackResponse.data.results.length > 0) {
          textData = fallbackResponse.data.results.map(result => ({
            id: result.id,
            score: result.score,
            title: result.metadata?.title || '',
            text: result.metadata?.text || result.metadata?.content || ''
          }));
          console.log(`Found ${textData.length} text items from fallback endpoint`);
        } else {
          console.log('No text data found in Pinecone');
        }
      }
    } catch (error) {
      console.error('Error fetching text data from Pinecone service:', error.message);
      return res.status(503).json({ 
        error: 'Failed to connect to Pinecone service for text data', 
        details: error.message 
      });
    }
    
    // If no text data was found, we can't generate a meaningful presentation
    if (textData.length === 0) {
      return res.status(404).json({ 
        error: 'No text content found in Pinecone database for your query', 
        details: 'Try a different search query or ensure content has been indexed in Pinecone' 
      });
    }
    
    // Try to fetch image data from Flask service using the specialized image endpoint
    console.log('Fetching image data from Python service...');
    try {
      const imageResponse = await axios.post(`${FLASK_SERVICE_URL}/query-images`, {
        query,
        topK: Math.min(numSlides * 2, 20)
      });
      
      if (imageResponse.data && imageResponse.data.images && imageResponse.data.images.length > 0) {
        imageData = imageResponse.data.images;
        console.log(`Found ${imageData.length} images from specialized image endpoint`);
      } else {
        console.log('No image data found in specialized endpoint, trying fallback');
        
        // Try fallback to regular endpoint
        const fallbackResponse = await axios.post(`${FLASK_SERVICE_URL}/query-pinecone`, {
          query,
          topK: Math.min(numSlides * 2, 20),
          contentType: 'image'
        });
        
        if (fallbackResponse.data && fallbackResponse.data.results && fallbackResponse.data.results.length > 0) {
          imageData = fallbackResponse.data.results.map(result => ({
            id: result.id,
            score: result.score,
            imageUrl: result.metadata?.image_url || '',
            title: result.metadata?.filename || '',
            classification: 'image'
          }));
          console.log(`Found ${imageData.length} images from fallback endpoint`);
        } else {
          console.log('No image data found in Pinecone');
        }
      }
    } catch (error) {
      console.error('Error fetching image data from Pinecone service:', error.message);
      // Continue with text-only presentation if image fetch fails
      console.log('Continuing with text-only presentation');
    }
    
    // Load PowerPoint template
    const templatePath = path.join(templatesDir, 'CAFB_SlideDeck_Template.pptx');
    
    // Use pptxgenjs to generate PowerPoint - fixed import and initialization
    console.log('Creating PowerPoint presentation...');
    // Import PptxGenJS correctly
    const PptxGenJS = require('pptxgenjs');
    // Create a new instance properly
    const presentation = new PptxGenJS();
    
    // Generate slides based on content
    const generatedSlides = generateSlides(numSlides, textData, imageData, presentation);
    console.log(`Generated ${generatedSlides} slides`);
    
    // Write to a buffer and send - use the correct async method
    console.log('Generating PowerPoint buffer...');
    
    // Use the proper method to generate a buffer based on the pptxgenjs version
    let buffer;
    if (typeof presentation.write === 'function' && typeof presentation.write().then === 'function') {
      // pptxgenjs v3.8.0+
      buffer = await presentation.write('blob');
    } else if (typeof presentation.writeBuffer === 'function') {
      // Older versions
      buffer = await presentation.writeBuffer();
    } else if (typeof presentation.generate === 'function') {
      // Very old versions
      buffer = await new Promise((resolve) => {
        presentation.generate({
          type: 'nodebuffer',
          finalize: (blob) => {
            resolve(blob);
          }
        });
      });
    } else {
      throw new Error('Unable to find compatible method to generate PowerPoint buffer');
    }
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', 'attachment; filename="CAFB_Presentation.pptx"');
    res.send(buffer);
    
  } catch (error) {
    console.error('Error generating PowerPoint:', error);
    res.status(500).json({ error: 'Failed to generate PowerPoint presentation', details: error.message });
  }
});

// Function to generate slides based on content and template
function generateSlides(numSlides, textData, imageData, presentation) {
  // Define color schemes for different slide types
  const colors = {
    darkGreen: { fill: '004D40', text: 'FFFFFF' },
    orange: { fill: 'FF5722', text: 'FFFFFF' },
    lightGreen: { fill: '8BC34A', text: '333333' }
  };
  
  // Track number of slides created
  let slidesCreated = 0;
  
  // Create a title slide
  const titleSlide = presentation.addSlide();
  titleSlide.background = { color: colors.darkGreen.fill };
  titleSlide.addText("Capital Area Food Bank", { 
    x: 1, y: 1, w: '80%', h: 1.5,
    color: colors.darkGreen.text,
    fontSize: 44,
    bold: true,
    align: 'center'
  });
  
  const today = new Date();
  const dateString = `${today.getMonth()+1}/${today.getDate()}/${today.getFullYear()}`;
  
  titleSlide.addText("Serving our community", { 
    x: 1, y: 2.7, w: '80%', h: 0.75,
    color: colors.darkGreen.text,
    fontSize: 28,
    align: 'center'
  });
  
  titleSlide.addText(dateString, { 
    x: 1, y: 3.5, w: '80%', h: 0.5,
    color: colors.darkGreen.text,
    fontSize: 16,
    align: 'center'
  });
  
  // Add a placeholder image if available
  if (imageData.length > 0) {
    const firstImage = imageData[0];
    const imageUrl = firstImage.imageUrl || firstImage.metadata?.image_url || '';
    
    if (imageUrl) {
      titleSlide.addImage({ 
        path: imageUrl,
        x: 5.5, y: 4.5, w: 4, h: 5
      });
    }
  }
  
  slidesCreated++;
  
  // Determine how many content slides to create
  const remainingSlides = Math.min(numSlides - 1, 20);
  
  // Initialize theme tracking
  let currentTheme = 'darkGreen';
  let needsSectionHeader = true;
  
  // Helper function to extract bullet points from text
  function extractBulletPoints(text, count = 5) {
    if (!text) return [];
    // First try to split by periods, then by other sentence-ending punctuation
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.slice(0, count).map(s => s.trim());
  }
  
  // Create remaining slides
  for (let i = 0; i < remainingSlides && slidesCreated < numSlides; i++) {
    // Get text and image data for this slide
    const textIndex = i % textData.length;
    const slideTextData = textData[textIndex];
    const slideImageData = imageData.length > i ? imageData[i] : null;
    
    // Extract title and content from the data structure
    const slideTitle = slideTextData.title || slideTextData.metadata?.title || "Section Title";
    
    // Get content text depending on the data structure
    let contentText = '';
    if (slideTextData.text) {
      contentText = slideTextData.text;
    } else if (slideTextData.content) {
      contentText = slideTextData.content;
    } else if (slideTextData.metadata?.text) {
      contentText = slideTextData.metadata.text;
    } else if (slideTextData.metadata?.content) {
      contentText = slideTextData.metadata.content;
    }
    
    // Get image URL depending on the data structure
    let imageUrl = '';
    if (slideImageData) {
      imageUrl = slideImageData.imageUrl || slideImageData.metadata?.image_url || '';
    }
    
    // Switch theme every few slides
    if (i % 3 === 0) {
      if (currentTheme === 'darkGreen') currentTheme = 'orange';
      else if (currentTheme === 'orange') currentTheme = 'lightGreen';
      else currentTheme = 'darkGreen';
      
      needsSectionHeader = true;
    }
    
    // Create a section header slide if needed
    if (needsSectionHeader && slidesCreated < numSlides) {
      const sectionSlide = presentation.addSlide();
      sectionSlide.background = { color: colors[currentTheme].fill };
      
      sectionSlide.addText(slideTitle, {
        x: 0.5, y: 2.5, w: '70%', h: 1.5,
        color: colors[currentTheme].text,
        fontSize: 40,
        bold: true
      });
      
      // Add image if available
      if (imageUrl) {
        try {
          sectionSlide.addImage({
            path: imageUrl,
            x: 6, y: 1.5, w: 3.5, h: 5
          });
        } catch (error) {
          console.error(`Error adding image to section slide: ${error.message}`);
        }
      }
      
      slidesCreated++;
      needsSectionHeader = false;
      
      // Skip to next content if we've reached slide limit
      if (slidesCreated >= numSlides) break;
    }
    
    // Create a content slide
    const contentSlide = presentation.addSlide();
    contentSlide.background = { color: 'FFFFFF' };
    
    // Add colored header - use the correct method for the version of pptxgenjs
    try {
      // Try modern shape approach first
      if (typeof presentation.ShapeType === 'object' && presentation.ShapeType.rect) {
        contentSlide.addShape(presentation.ShapeType.rect, {
          x: 0, y: 0, w: '100%', h: 0.8,
          fill: { color: colors[currentTheme].fill }
        });
      } else {
        // Fallback to drawing a rectangle directly
        contentSlide.addShape('rect', {
          x: 0, y: 0, w: '100%', h: 0.8,
          fill: { color: colors[currentTheme].fill }
        });
      }
    } catch (error) {
      console.error(`Error adding shape to slide: ${error.message}`);
    }
    
    // Add slide title
    contentSlide.addText(slideTitle, {
      x: 0.5, y: 0.15, w: '70%', h: 0.5,
      color: colors[currentTheme].text,
      fontSize: 24,
      bold: true
    });
    
    // Add bullet points
    const bullets = extractBulletPoints(contentText, 5);
    if (bullets.length > 0) {
      const bulletText = bullets.map(b => `• ${b}`).join('\n');
      contentSlide.addText(bulletText, {
        x: 0.5, y: 1.5, w: imageUrl ? '60%' : '90%', h: 5,
        color: '333333',
        fontSize: 16,
        breakLine: true
      });
    }
    
    // Add image if available
    if (imageUrl) {
      try {
        contentSlide.addImage({
          path: imageUrl,
          x: 7, y: 1.5, w: 3, h: 4
        });
      } catch (error) {
        console.error(`Error adding image to content slide: ${error.message}`);
      }
    }
    
    slidesCreated++;
    
    // Add a slide with two images if we have enough images and slides
    if (i < imageData.length - 1 && slidesCreated < numSlides) {
      const nextImageUrl = imageData[i+1].imageUrl || imageData[i+1].metadata?.image_url || '';
      
      if (imageUrl && nextImageUrl) {
        const twoImageSlide = presentation.addSlide();
        twoImageSlide.background = { color: 'FFFFFF' };
        
        // Add colored header - use the correct method for the version of pptxgenjs
        try {
          if (typeof presentation.ShapeType === 'object' && presentation.ShapeType.rect) {
            twoImageSlide.addShape(presentation.ShapeType.rect, {
              x: 0, y: 0, w: '100%', h: 0.8,
              fill: { color: colors[currentTheme].fill }
            });
          } else {
            twoImageSlide.addShape('rect', {
              x: 0, y: 0, w: '100%', h: 0.8,
              fill: { color: colors[currentTheme].fill }
            });
          }
        } catch (error) {
          console.error(`Error adding shape to two-image slide: ${error.message}`);
        }
        
        // Add slide title
        twoImageSlide.addText(slideTitle || "Visual Examples", {
          x: 0.5, y: 0.15, w: '70%', h: 0.5,
          color: colors[currentTheme].text,
          fontSize: 24,
          bold: true
        });
        
        // Add first image
        try {
          twoImageSlide.addImage({
            path: imageUrl,
            x: 0.5, y: 1.5, w: 4.5, h: 3.5
          });
        } catch (error) {
          console.error(`Error adding first image to two-image slide: ${error.message}`);
        }
        
        // Add second image
        try {
          twoImageSlide.addImage({
            path: nextImageUrl,
            x: 5.5, y: 1.5, w: 4.5, h: 3.5
          });
        } catch (error) {
          console.error(`Error adding second image to two-image slide: ${error.message}`);
        }
        
        slidesCreated++;
        i++; // Skip an extra image since we used two
      }
    }
  }
  
  // Add a closing slide if we still have space
  if (slidesCreated < numSlides) {
    const closingSlide = presentation.addSlide();
    closingSlide.background = { color: colors.darkGreen.fill };
    
    closingSlide.addText("Thank You", {
      x: 1, y: 2, w: '80%', h: 1.5,
      color: 'FFFFFF',
      fontSize: 44,
      bold: true,
      align: 'center'
    });
    
    closingSlide.addText("Capital Area Food Bank", {
      x: 1, y: 4, w: '80%', h: 0.75,
      color: 'FFFFFF',
      fontSize: 24,
      align: 'center'
    });
    
    slidesCreated++;
  }
  
  return slidesCreated;
}

// API endpoint for AI editing
app.post('/api/ai-edit', async (req, res) => {
  try {
    const { query, currentHtml, grantType } = req.body;
    
    if (!query || !currentHtml) {
      return res.status(400).json({ error: 'Query and current HTML are required' });
    }
    
    // Configure the model - using Gemini 2.0
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Create structured prompt for AI editing
    const prompt = `
      You are an AI document editor specialized in grant proposals. 
      I have a ${grantType} grant document in HTML format, and I need you to edit it according to this request: "${query}"
      
      Rules for editing:
      1. Maintain the same HTML structure and format with # markers and h1 tags
      2. Only modify the content as requested, keeping the overall formatting consistent
      3. Ensure headers remain intact (like POSTING DATE, SOLICITED BY, etc.)
      4. Return the complete edited HTML, not just the changes
      5. Make thoughtful, relevant edits based on the request
      
      Here is the current HTML document:
      ${currentHtml}
      
      Please provide the complete edited HTML in response.
    `;
    
    // Generate edited content
    const result = await model.generateContent(prompt);
    const response = result.response;
    const editedHtml = response.text();
    
    res.json({ 
      editedHtml,
      message: "Document edited successfully"
    });
  } catch (error) {
    console.error('Error editing document:', error);
    res.status(500).json({ error: 'Error editing document' });
  }
});

// API endpoint for selective text editing
app.post('/api/selective-edit', async (req, res) => {
  try {
    console.log('Received selective edit request:', JSON.stringify({
      textLength: req.body.selectedText ? req.body.selectedText.length : 0,
      queryLength: req.body.query ? req.body.query.length : 0,
      hasContext: !!req.body.documentContext,
      hasFullDocument: !!req.body.fullDocument,
      grantType: req.body.grantType
    }));
    
    const { selectedText, query, fullDocument, grantType } = req.body;
    
    if (!selectedText || !query || !fullDocument) {
      console.log('Error: Missing required fields', { 
        hasSelectedText: !!selectedText, 
        hasQuery: !!query,
        hasFullDocument: !!fullDocument
      });
      return res.status(400).json({ error: 'Selected text, query, and full document are required' });
    }
    
    // Configure the model - using Gemini 2.0
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Create structured prompt for selective editing
    const prompt = `
      You are an AI document editor specialized in grant proposals. 
      
      I have a complete ${grantType} grant document in HTML format. I need you to edit a SPECIFIC SECTION of this document based on the following request: "${query}"
      
      THE SECTION TO EDIT IS:
      "${selectedText}"
      
      FULL DOCUMENT HTML:
      ${fullDocument}
      
      Rules for editing:
      1. Return the ENTIRE document HTML with ONLY the specified section modified according to the request
      2. Maintain exactly the same HTML structure, including all # markers, h1 tags, and formatting
      3. Do not alter any part of the document outside of the specific section to be edited
      4. Make thoughtful, relevant edits to the specified section based on the request
      5. Keep any existing styling or formatting in the edited section
      
      Please provide the complete edited document HTML as your response.
    `;
    
    // Generate edited content
    const result = await model.generateContent(prompt);
    const response = result.response;
    const editedDocument = response.text().trim();
    
    res.json({ 
      editedDocument,
      message: "Document edited successfully"
    });
  } catch (error) {
    console.error('Error in selective-edit endpoint:', error);
    res.status(500).json({ error: 'Error editing selected text', details: error.message });
  }
});

// API endpoint for document generation
app.post('/api/generate', async (req, res) => {
  try {
    const { query, outputType, numPages, grantType } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    console.log(`Generating document - Query: "${query}", Output type: ${outputType}, Grant type: ${grantType || 'none'}`);
    
    // Configure the model - using Gemini 1.5 Flash
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Create structured prompt based on document type and pages
    let prompt = '';
    
    if (outputType === 'grant') {
      // Different prompts based on grant type
      if (grantType === 'rfp' || !grantType) {
        prompt = `Generate a structured grant RFP (Request for Proposal) document about: ${query}.
        
        Please use the following structured format carefully so it can be properly formatted in a Word document:
        
        # GRANT RFP: [Title]
        
        ## POSTING DATE
        [Current date or appropriate posting date]
        
        ## SOLICITED BY
        [Name of organization soliciting proposals]
        
        ## ADDRESS OF SOLICITING PARTY
        [Address of the organization]
        
        ## I. PURPOSE OF REQUEST FOR PROPOSAL
        [Clear description of what the grant aims to fund and overall purpose]
        
        ## II. ORGANIZATION BACKGROUND
        [Background information about the soliciting organization]
        
        ## III. TIMELINE FOR SCOPE OF SERVICES
        [Include a detailed timeline with projected dates for each activity in table format]
        
        | ACTIVITY | PROJECTED DATE |
        | -------- | -------------- |
        | A. Grant Application Period | [Date range] |
        | B. Prior to Final Grant Submissions | [Date range] |
        | C. After Final Grant Submissions | [Date range] |
        | D. Underwriting Period | [Date range] |
        | E. Underwriting Review | [Date range] |
        | F. Revisions and Final Report | [Date range] |
        
        ## IV. SCOPE OF SERVICES
        
        ### A. GRANT APPLICATION PERIOD
        [Details about the application period process]
        
        ### B. PRIOR TO FINAL GRANT SUBMISSIONS
        [Requirements and processes before submission]
        
        ### C. AFTER FINAL GRANT SUBMISSIONS
        [What happens after submissions are received]
        
        ### D. UNDERWRITING PERIOD
        [Details about the underwriting process]
        
        ### E. UNDERWRITING REVIEW
        [Information about review criteria and process]
        
        ### F. REVISIONS AND FINAL REPORT
        [Requirements for revisions and final reporting]
        
        ## V. SUBMISSION PROCESS
        [Detailed instructions for how to submit grant applications]
        
        ## VI. QUESTIONS / INQUIRIES INFORMATION
        [Contact information and process for submitting questions]`;
      } else if (grantType === 'generic') {
        prompt = `Generate a structured generic grant proposal about: ${query}.
        
        Please use the following structured format carefully:
        
        # GRANT PROPOSAL: [Title]
        
        ## EXECUTIVE SUMMARY
        [Brief overview of the proposal]
        
        ## ORGANIZATION INFORMATION
        [Information about the organization applying for the grant]
        
        ## STATEMENT OF NEED
        [Clear explanation of the problem or need that this grant will address]
        
        ## PROJECT DESCRIPTION
        [Detailed description of the proposed project, activities, and goals]
        
        ## GOALS AND OBJECTIVES
        [Specific, measurable goals and objectives]
        
        ## TIMELINE
        [Project timeline with milestones in a table format]
        
        | MILESTONE | COMPLETION DATE |
        | --------- | --------------- |
        | [Milestone 1] | [Date] |
        | [Milestone 2] | [Date] |
        | [Milestone 3] | [Date] |
        
        ## BUDGET
        [Detailed budget breakdown in table format]
        
        | EXPENSE CATEGORY | AMOUNT | DESCRIPTION |
        | ---------------- | ------ | ----------- |
        | [Category 1] | [Amount] | [Description] |
        | [Category 2] | [Amount] | [Description] |
        | [Category 3] | [Amount] | [Description] |
        | TOTAL | [Total Amount] | |
        
        ## EVALUATION PLAN
        [How the project's success will be measured and evaluated]
        
        ## SUSTAINABILITY
        [How the project will continue after grant funding ends]
        
        ## CONCLUSION
        [Summary statement about the importance of this project]`;
      } else if (grantType === 'nonprofit') {
        prompt = `Generate a structured non-profit grant proposal about: ${query}.
        
        Please use the following structured format carefully:
        
        # NON-PROFIT GRANT PROPOSAL: [Title]
        
        ## EXECUTIVE SUMMARY
        [Brief overview of the proposal and organization]
        
        ## ORGANIZATION HISTORY AND MISSION
        [History, mission statement, and core values of the non-profit]
        
        ## COMMUNITY NEED
        [Description of the community need being addressed]
        
        ## PROGRAM DESCRIPTION
        [Detailed description of the program or initiative]
        
        ## TARGET POPULATION
        [Description of who will be served by this program]
        
        ## EXPECTED IMPACT
        [The anticipated outcomes and impact on the community]
        
        ## GOALS AND OBJECTIVES
        [Specific, measurable goals and objectives]
        
        ## TIMELINE
        [Project timeline with key milestones in a table format]
        
        | MILESTONE | COMPLETION DATE |
        | --------- | --------------- |
        | [Milestone 1] | [Date] |
        | [Milestone 2] | [Date] |
        | [Milestone 3] | [Date] |
        
        ## BUDGET
        [Detailed budget breakdown]
        
        | EXPENSE CATEGORY | AMOUNT | DESCRIPTION |
        | ---------------- | ------ | ----------- |
        | [Category 1] | [Amount] | [Description] |
        | [Category 2] | [Amount] | [Description] |
        | [Category 3] | [Amount] | [Description] |
        | TOTAL | [Total Amount] | |
        
        ## EVALUATION METRICS
        [How success will be measured and reported]
        
        ## SUSTAINABILITY PLAN
        [How the program will be sustained beyond the grant period]
        
        ## ORGANIZATIONAL CAPACITY
        [Description of the organization's ability to implement the program]
        
        ## CONCLUSION
        [Closing appeal for support]`;
      } else if (grantType === 'research') {
        prompt = `Generate a structured research grant proposal about: ${query}.
        
        Please use the following structured format carefully:
        
        # RESEARCH GRANT PROPOSAL: [Title]
        
        ## ABSTRACT
        [Brief summary of the research project]
        
        ## INTRODUCTION
        [Introduction to the research topic and its importance]
        
        ## LITERATURE REVIEW
        [Summary of existing research and identification of gaps]
        
        ## RESEARCH QUESTION(S)
        [Clear statement of research questions]
        
        ## METHODOLOGY
        [Detailed description of research methods, procedures, and design]
        
        ## DATA COLLECTION AND ANALYSIS
        [Description of how data will be collected, managed, and analyzed]
        
        ## TIMELINE
        [Research timeline with phases in a table format]
        
        | RESEARCH PHASE | TIME PERIOD |
        | -------------- | ----------- |
        | [Phase 1] | [Time Period] |
        | [Phase 2] | [Time Period] |
        | [Phase 3] | [Time Period] |
        
        ## BUDGET
        [Create a detailed budget that incorporates the staff positions and percentages mentioned in the context]
        
        | EXPENSE CATEGORY | AMOUNT | JUSTIFICATION |
        | ---------------- | ------ | ------------- |
        | [Category 1] | [Amount] | [Justification] |
        | [Category 2] | [Amount] | [Justification] |
        | [Category 3] | [Amount] | [Justification] |
        | TOTAL | [Total Amount] | |
        
        ## EXPECTED OUTCOMES
        [Describe expected research findings related to the project]
        
        ## SIGNIFICANCE AND IMPACT
        [Discuss the significance of this research]
        
        ## DISSEMINATION PLAN
        [Describe how findings will be shared]
        
        ## RESEARCH TEAM
        [List the research team incorporating the staff mentioned in the context with their specific roles]
        
        ## REFERENCES
        [Include relevant references]`;
      }
      
      prompt += `\n\nPlease ensure all sections are detailed and specific to the query: ${query}.
      
      IMPORTANT: Make all tables well-formatted with proper rows and columns to be easily converted to a Word document table.`;
    } else if (outputType === 'pdf') {
      prompt = `Generate a structured PDF document with ${numPages} pages about: ${query}.
      
      Please use the following structured format:
      
      # Title
      ## Introduction
      [Introduction content]
      
      ## Main Section 1
      [Section content with key points and detailed explanations]
      
      ## Main Section 2
      [Section content with key points and detailed explanations]
      
      ## Main Section 3
      [Section content with key points and detailed explanations]
      
      ## Conclusion
      [Concluding thoughts]
      
      Ensure there are ${numPages} pages worth of content with proper headings, subheadings, and paragraphs.`;
    } else if (outputType === 'docx') {
      prompt = `Generate a structured DOCX document with ${numPages} pages about: ${query}.
      
      Please use the following structured format:
      
      # Title
      ## Introduction
      [Introduction content]
      
      ## Main Section 1
      [Section content with key points and detailed explanations]
      
      ## Main Section 2
      [Section content with key points and detailed explanations]
      
      ## Main Section 3
      [Section content with key points and detailed explanations]
      
      ## Conclusion
      [Concluding thoughts]
      
      Ensure there are ${numPages} pages worth of content with proper headings, subheadings, and paragraphs.`;
    } else if (outputType === 'ppt') {
      prompt = `Generate content for a PowerPoint presentation with exactly ${numPages} slides about: ${query}.
      
      Format each slide as:
      
      Slide 1: Title
      [Title of presentation]
      [Subtitle or brief description]
      
      Slide 2: Agenda/Overview
      • [Bullet point 1]
      • [Bullet point 2]
      • [Bullet point 3]
      
      Slide 3: [Topic 1]
      • [Key point 1]
      • [Key point 2]
      • [Supporting detail]
      
      Continue with this exact format for all ${numPages} slides. Include introduction slides, content slides, and a conclusion slide.`;
    } else if (outputType === 'x') {
      prompt = `Craft a structured Twitter/X post about: ${query}.
      
      Format as:
      
      POST:
      [Main content of the tweet - compelling and concise, within character limit]
      
      HASHTAGS:
      [3-5 relevant hashtags]
      
      ENGAGEMENT PROMPT:
      [Question or call to action to encourage engagement]`;
    } else if (outputType === 'instagram') {
      prompt = `Create an Instagram post about: ${query}.
      
      Format as:
      
      CAPTION:
      [Engaging opening line]
      
      [Main content with storytelling elements]
      
      [Call to action]
      
      HASHTAGS:
      [8-10 relevant hashtags]`;
    }
    
    // Generate content
    try {
      const result = await model.generateContent(prompt);
      
      if (!result || !result.response) {
        console.error('Empty response from Gemini API');
        return res.status(500).json({ error: 'Empty response from AI model' });
      }
      
      const text = result.response.text();
      
      if (!text) {
        console.error('Empty text in Gemini API response');
        return res.status(500).json({ error: 'AI model returned empty content' });
      }
      
      console.log(`Successfully generated content (${text.length} characters)`);
      
      res.json({
        content: text,
        outputType,
        grantType: outputType === 'grant' ? grantType : null
      });
    } catch (modelError) {
      console.error('Error from Gemini API:', modelError);
      return res.status(500).json({ error: 'Error generating content from AI model', details: modelError.message });
    }
  } catch (error) {
    console.error('Error generating document:', error);
    res.status(500).json({ error: 'Error generating document', details: error.message });
  }
});

// API endpoint for document review and suggestions
app.post('/api/review-document', async (req, res) => {
  try {
    const { documentHtml } = req.body;
    
    if (!documentHtml) {
      return res.status(400).json({ error: 'Document content is required' });
    }
    
    // Configure the model - using Gemini 2.0 Flash
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Create a prompt for document review
    const prompt = `Review the following document content and identify any issues that need attention. 
    Focus on:
    1. Grammatical errors
    2. Factual inaccuracies
    3. Confusing or unclear language
    4. Formatting issues
    5. Any other problems you notice
    
    IMPORTANT INSTRUCTIONS:
    - IGNORE all hashtags (#, ##, ###) and markdown-style formatting as these are intentional formatting elements
    - Do NOT suggest changes to the document structure or heading format
    - Only focus on actual content issues like grammar, factual errors, and clarity
    - Do not be concerned with the number of hashtags or their placement
    
    For each issue, provide:
    1. The problematic text
    2. Why it's a problem
    3. A suggested correction
    
    Format your response as a JSON array of objects with the following structure:
    [
      {
        "problem": "The problematic text",
        "reason": "Why it's a problem",
        "suggestion": "Suggested correction"
      }
    ]
    
    If there are no issues, return an empty array.
    
    Here is the document content:
    ${documentHtml}`;
    
    // Generate content with Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Extract the JSON array from the response
    let suggestions = [];
    try {
      // Extract JSON if it's wrapped in code blocks or other text
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON array found, try to parse the entire response
        suggestions = JSON.parse(text);
      }
    } catch (error) {
      console.error('Error parsing JSON from Gemini response:', error);
      console.log('Raw response:', text);
      return res.status(500).json({ 
        error: 'Failed to parse suggestions', 
        rawResponse: text 
      });
    }
    
    res.json({ suggestions });
  } catch (error) {
    console.error('Error in document review:', error);
    res.status(500).json({ error: 'Internal server error during document review' });
  }
});

// API endpoint for getting available templates
app.get('/api/templates', (req, res) => {
  try {
    const templates = [];
    
    // Read all files in the templates directory
    fs.readdirSync(templatesDir).forEach(file => {
      if (file.endsWith('.docx') || file.endsWith('.xlsx') || file.endsWith('.pptx')) {
        templates.push({
          name: file.replace(/\.[^/.]+$/, ""), // Remove extension
          filename: file,
          type: path.extname(file).substring(1).toUpperCase()
        });
      }
    });
    
    res.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// API endpoint for generating documents using Carbone
app.post('/api/generate-from-template', (req, res) => {
  try {
    const { templateName, data } = req.body;
    
    if (!templateName) {
      return res.status(400).json({ error: 'Template name is required' });
    }
    
    // Find the template file
    const templateFile = fs.readdirSync(templatesDir)
      .find(file => file.toLowerCase() === templateName.toLowerCase() || file.replace(/\.[^/.]+$/, "").toLowerCase() === templateName.toLowerCase());
    
    if (!templateFile) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const templatePath = path.join(templatesDir, templateFile);
    const outputFormat = path.extname(templateFile).substring(1); // Get the format from the template extension
    
    // Generate document using Carbone
    carbone.render(templatePath, data, { convertTo: outputFormat }, (err, result) => {
      if (err) {
        console.error('Error generating document:', err);
        return res.status(500).json({ error: 'Failed to generate document' });
      }
      
      // Set appropriate headers for file download
      res.setHeader('Content-Disposition', `attachment; filename=${templateName}.${outputFormat}`);
      res.setHeader('Content-Type', getMimeType(outputFormat));
      
      // Send the generated document
      res.send(result);
    });
  } catch (error) {
    console.error('Error generating document:', error);
    res.status(500).json({ error: 'Failed to generate document' });
  }
});

// Helper function to get MIME type based on file extension
function getMimeType(extension) {
  const mimeTypes = {
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'pdf': 'application/pdf'
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

// API endpoint for generating PowerPoint with template and previewing as HTML
app.post('/api/preview-ppt-from-template', async (req, res) => {
  try {
    const { numSlides, query } = req.body;
    
    if (!numSlides || !query) {
      return res.status(400).json({ error: 'Number of slides and query are required' });
    }
    
    console.log(`Generating PowerPoint Preview - Query: "${query}", Slides: ${numSlides}`);
    
    // Initialize empty arrays for data
    let textData = [];
    let imageData = [];
    
    // Try to fetch text data from Flask service
    console.log('Fetching text data from Python service...');
    try {
      const textResponse = await axios.post(`${FLASK_SERVICE_URL}/query-documents`, {
        query,
        topK: Math.min(numSlides * 2, 20)
      });
      
      if (textResponse.data && textResponse.data.documents && textResponse.data.documents.length > 0) {
        textData = textResponse.data.documents;
        console.log(`Found ${textData.length} text items from Pinecone`);
      } else {
        console.log('No text data found in specialized endpoint, trying fallback');
        
        // Try fallback to regular endpoint
        const fallbackResponse = await axios.post(`${FLASK_SERVICE_URL}/query-pinecone`, {
          query,
          topK: Math.min(numSlides * 2, 20),
          contentType: 'document'
        });
        
        if (fallbackResponse.data && fallbackResponse.data.results && fallbackResponse.data.results.length > 0) {
          textData = fallbackResponse.data.results.map(result => ({
            id: result.id,
            score: result.score,
            title: result.metadata?.title || '',
            text: result.metadata?.text || result.metadata?.content || ''
          }));
          console.log(`Found ${textData.length} text items from fallback endpoint`);
        } else {
          console.log('No text data found in Pinecone');
        }
      }
    } catch (error) {
      console.error('Error fetching text data from Pinecone service:', error.message);
      return res.status(503).json({ 
        error: 'Failed to connect to Pinecone service for text data', 
        details: error.message 
      });
    }
    
    // If no text data was found, we can't generate a meaningful presentation
    if (textData.length === 0) {
      return res.status(404).json({ 
        error: 'No text content found in Pinecone database for your query', 
        details: 'Try a different search query or ensure content has been indexed in Pinecone' 
      });
    }
    
    // Try to fetch image data from Flask service using the specialized image endpoint
    console.log('Fetching image data from Python service...');
    try {
      const imageResponse = await axios.post(`${FLASK_SERVICE_URL}/query-images`, {
        query,
        topK: Math.min(numSlides * 2, 20)
      });
      
      if (imageResponse.data && imageResponse.data.images && imageResponse.data.images.length > 0) {
        imageData = imageResponse.data.images;
        console.log(`Found ${imageData.length} images from specialized image endpoint`);
      } else {
        console.log('No image data found in specialized endpoint, trying fallback');
        
        // Try fallback to regular endpoint
        const fallbackResponse = await axios.post(`${FLASK_SERVICE_URL}/query-pinecone`, {
          query,
          topK: Math.min(numSlides * 2, 20),
          contentType: 'image'
        });
        
        if (fallbackResponse.data && fallbackResponse.data.results && fallbackResponse.data.results.length > 0) {
          imageData = fallbackResponse.data.results.map(result => ({
            id: result.id,
            score: result.score,
            imageUrl: result.metadata?.image_url || '',
            title: result.metadata?.filename || '',
            classification: 'image'
          }));
          console.log(`Found ${imageData.length} images from fallback endpoint`);
        } else {
          console.log('No image data found in Pinecone');
        }
      }
    } catch (error) {
      console.error('Error fetching image data from Pinecone service:', error.message);
      // Continue with text-only presentation if image fetch fails
      console.log('Continuing with text-only presentation');
    }
    
    // Generate HTML preview of slides
    const htmlPreview = generateHTMLPreview(numSlides, textData, imageData);
    console.log(`Generated HTML preview with ${numSlides} slides`);
    
    // Return HTML preview
    res.json({
      htmlPreview,
      numSlides,
      textCount: textData.length,
      imageCount: imageData.length
    });
    
  } catch (error) {
    console.error('Error generating PowerPoint preview:', error);
    res.status(500).json({ error: 'Failed to generate PowerPoint preview', details: error.message });
  }
});

// Function to generate HTML preview of slides
function generateHTMLPreview(numSlides, textData, imageData) {
  // Define color schemes for different slide types
  const colors = {
    darkGreen: { fill: '#004D40', text: '#FFFFFF' },
    orange: { fill: '#FF5722', text: '#FFFFFF' },
    lightGreen: { fill: '#8BC34A', text: '#333333' }
  };
  
  // Start HTML string
  let html = `
    <div class="slide-preview-container">
      <div class="slide-controls">
        <button class="prev-slide">&larr; Previous</button>
        <span class="slide-counter">Slide 1 of ${numSlides}</span>
        <button class="next-slide">Next &rarr;</button>
      </div>
      <div class="slides-wrapper">
  `;
  
  // Add title slide
  const today = new Date();
  const dateString = `${today.getMonth()+1}/${today.getDate()}/${today.getFullYear()}`;
  
  html += `
    <div class="slide title-slide" style="background-color: ${colors.darkGreen.fill};">
      <h1 style="color: ${colors.darkGreen.text};">Capital Area Food Bank</h1>
      <h3 style="color: ${colors.darkGreen.text};">Serving our community</h3>
      <p class="date" style="color: ${colors.darkGreen.text};">${dateString}</p>
  `;
  
  // Add image to title slide if available
  if (imageData.length > 0) {
    const firstImage = imageData[0];
    const imageUrl = firstImage.imageUrl || firstImage.metadata?.image_url || '';
    if (imageUrl) {
      html += `<div class="slide-image"><img src="${imageUrl}" alt="Title slide image"></div>`;
    }
  }
  
  html += `</div>`;
  
  // Initialize theme tracking
  let currentTheme = 'darkGreen';
  let needsSectionHeader = true;
  
  // Helper function to extract bullet points from text
  function extractBulletPoints(text, count = 5) {
    if (!text) return [];
    // First try to split by periods, then by other sentence-ending punctuation
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.slice(0, count).map(s => s.trim());
  }
  
  // Create remaining slides
  const remainingSlides = Math.min(numSlides - 1, 20);
  
  for (let i = 0; i < remainingSlides; i++) {
    // Get text and image data for this slide
    const textIndex = i % textData.length;
    const slideTextData = textData[textIndex];
    const slideImageData = imageData.length > i ? imageData[i] : null;
    
    // Extract title and content from the data structure
    const slideTitle = slideTextData.title || slideTextData.metadata?.title || "Section Title";
    
    // Get content text depending on the data structure
    let contentText = '';
    if (slideTextData.text) {
      contentText = slideTextData.text;
    } else if (slideTextData.content) {
      contentText = slideTextData.content;
    } else if (slideTextData.metadata?.text) {
      contentText = slideTextData.metadata.text;
    } else if (slideTextData.metadata?.content) {
      contentText = slideTextData.metadata.content;
    }
    
    // Get image URL depending on the data structure
    let imageUrl = '';
    if (slideImageData) {
      imageUrl = slideImageData.imageUrl || slideImageData.metadata?.image_url || '';
    }
    
    // Switch theme every few slides
    if (i % 3 === 0) {
      if (currentTheme === 'darkGreen') currentTheme = 'orange';
      else if (currentTheme === 'orange') currentTheme = 'lightGreen';
      else currentTheme = 'darkGreen';
      
      needsSectionHeader = true;
    }
    
    // Create a section header slide if needed
    if (needsSectionHeader) {
      html += `
        <div class="slide section-slide" style="background-color: ${colors[currentTheme].fill};">
          <h2 style="color: ${colors[currentTheme].text};">${slideTitle}</h2>
      `;
      
      // Add image if available
      if (imageUrl) {
        html += `<div class="slide-image section-image"><img src="${imageUrl}" alt="Section slide image"></div>`;
      }
      
      html += `</div>`;
      
      needsSectionHeader = false;
      
      // Skip to next slide if we've reached the limit
      if (i + 1 >= remainingSlides) break;
      i++;
    }
    
    // Create a content slide
    html += `
      <div class="slide content-slide">
        <div class="slide-header" style="background-color: ${colors[currentTheme].fill};">
          <h3 style="color: ${colors[currentTheme].text};">${slideTitle}</h3>
        </div>
        <div class="slide-content">
    `;
    
    // Add bullet points
    const bullets = extractBulletPoints(contentText, 5);
    if (bullets.length > 0) {
      html += `<ul class="bullet-points">`;
      
      for (const bullet of bullets) {
        html += `<li>${bullet}</li>`;
      }
      
      html += `</ul>`;
    }
    
    // Add image if available
    if (imageUrl) {
      html += `<div class="slide-content-image"><img src="${imageUrl}" alt="Content slide image"></div>`;
    }
    
    html += `
        </div>
      </div>
    `;
    
    // Add slide with two images if available and we haven't reached the limit
    if (i + 1 < remainingSlides && i + 1 < imageData.length) {
      const nextImageUrl = imageData[i+1].imageUrl || imageData[i+1].metadata?.image_url || '';
      
      if (imageUrl && nextImageUrl) {
        html += `
          <div class="slide two-image-slide">
            <div class="slide-header" style="background-color: ${colors[currentTheme].fill};">
              <h3 style="color: ${colors[currentTheme].text};">${slideTitle || "Visual Examples"}</h3>
            </div>
            <div class="two-images">
              <div class="image-left"><img src="${imageUrl}" alt="Left image"></div>
              <div class="image-right"><img src="${nextImageUrl}" alt="Right image"></div>
            </div>
          </div>
        `;
        
        i++; // Skip an extra image since we used two
      }
    }
  }
  
  // Add a closing slide
  html += `
    <div class="slide closing-slide" style="background-color: ${colors.darkGreen.fill};">
      <h1 style="color: ${colors.darkGreen.text};">Thank You</h1>
      <h3 style="color: ${colors.darkGreen.text};">Capital Area Food Bank</h3>
    </div>
  `;
  
  // Close the HTML container
  html += `
      </div>
      <style>
        .slide-preview-container {
          font-family: Arial, sans-serif;
          max-width: 900px;
          margin: 0 auto;
          background: #f5f5f5;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        
        .slide-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 20px;
          background: #333;
          color: white;
        }
        
        .slide-controls button {
          background: #555;
          color: white;
          border: none;
          padding: 8px 15px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .slide-controls button:hover {
          background: #777;
        }
        
        .slides-wrapper {
          position: relative;
          height: 500px;
          overflow: hidden;
        }
        
        .slide {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 20px;
          box-sizing: border-box;
          background-color: white;
          transition: transform 0.3s ease;
          transform: translateX(100%);
        }
        
        .slide.active {
          transform: translateX(0);
        }
        
        .title-slide, .closing-slide {
          justify-content: center;
          align-items: center;
          text-align: center;
        }
        
        .title-slide h1, .closing-slide h1 {
          font-size: 36px;
          margin-bottom: 20px;
        }
        
        .section-slide {
          justify-content: center;
          align-items: flex-start;
          padding: 40px;
        }
        
        .section-slide h2 {
          font-size: 32px;
          margin-bottom: 30px;
        }
        
        .content-slide {
          padding: 0;
        }
        
        .slide-header {
          width: 100%;
          padding: 10px 20px;
          box-sizing: border-box;
        }
        
        .slide-header h3 {
          margin: 0;
          font-size: 24px;
        }
        
        .slide-content {
          display: flex;
          padding: 20px;
          height: calc(100% - 50px);
        }
        
        .bullet-points {
          flex: 3;
          padding-right: 20px;
        }
        
        .slide-content-image {
          flex: 2;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .slide-content-image img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        
        .slide-image img {
          max-width: 300px;
          max-height: 200px;
          object-fit: contain;
          margin-top: 20px;
        }
        
        .section-image {
          position: absolute;
          right: 40px;
          top: 100px;
        }
        
        .two-images {
          display: flex;
          justify-content: space-between;
          width: 100%;
          height: calc(100% - 50px);
          padding: 20px;
        }
        
        .image-left, .image-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
        }
        
        .image-left img, .image-right img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
      </style>
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          const slides = document.querySelectorAll('.slide');
          const prevBtn = document.querySelector('.prev-slide');
          const nextBtn = document.querySelector('.next-slide');
          const counter = document.querySelector('.slide-counter');
          
          let currentSlide = 0;
          
          // Initialize first slide
          slides[0].classList.add('active');
          
          function showSlide(index) {
            // Remove active class from all slides
            slides.forEach(slide => slide.classList.remove('active'));
            
            // Ensure index is within bounds
            if (index < 0) index = 0;
            if (index >= slides.length) index = slides.length - 1;
            
            // Set current slide and add active class
            currentSlide = index;
            slides[currentSlide].classList.add('active');
            
            // Update counter
            counter.textContent = \`Slide \${currentSlide + 1} of \${slides.length}\`;
          }
          
          // Event listeners
          prevBtn.addEventListener('click', () => {
            showSlide(currentSlide - 1);
          });
          
          nextBtn.addEventListener('click', () => {
            showSlide(currentSlide + 1);
          });
          
          // Keyboard navigation
          document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
              showSlide(currentSlide - 1);
            } else if (e.key === 'ArrowRight') {
              showSlide(currentSlide + 1);
            }
          });
          
          // Initialize counter
          counter.textContent = \`Slide 1 of \${slides.length}\`;
        });
      </script>
    </div>
  `;
  
  return html;
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the application`);
  console.log(`Flask service URL: ${FLASK_SERVICE_URL}`);
}); 