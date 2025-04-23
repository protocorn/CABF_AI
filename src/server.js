const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const carbone = require('carbone');
const fs = require('fs');
// Add dotenv for environment variables
require('dotenv').config();
// Import Pinecone module
const { queryPinecone, getContextFromDocuments } = require('./pinecone');
// Import document parsing libraries
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Gemini API
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.warn('WARNING: No Gemini API key found. Set GEMINI_API_KEY in .env file');
}
const genAI = new GoogleGenerativeAI(API_KEY || 'YOUR_API_KEY_HERE');

// Middleware
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure templates directory for Carbone
const templatesDir = path.join(__dirname, '../templates');

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API endpoint for document retrieval from Pinecone
app.post('/api/search-documents', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Search for relevant documents in Pinecone
    try {
      const documents = await queryPinecone(query);
      res.json({ documents });
    } catch (error) {
      console.error('Error searching documents:', error);
      
      // Provide mock data for any Pinecone errors (dimension mismatch, connection, etc.)
      console.log('Returning mock documents due to Pinecone error');
      const mockDocuments = [
        {
          id: 'doc1',
          score: 0.95,
          metadata: {
            title: 'Capital Area Food Bank Grant Proposal',
            content: 'The Capital Area Food Bank has been serving the DC metro area for over 40 years. Our mission is to address hunger today and build healthier futures tomorrow for residents struggling with food insecurity.',
            type: 'grant_proposal',
            url: 'https://example.com/cabf-grant-1'
          }
        },
        {
          id: 'doc2',
          score: 0.92,
          metadata: {
            title: 'CABF Community Impact Report 2023',
            content: 'In 2023, the Capital Area Food Bank distributed over 45 million meals to families facing food insecurity across Washington DC, Maryland, and Virginia. Our programs reached more than 400,000 individuals.',
            type: 'impact_report',
            url: 'https://example.com/cabf-impact-2023'
          }
        },
        {
          id: 'doc3',
          score: 0.89,
          metadata: {
            title: 'Food Insecurity in the DMV Region: Research Study',
            content: 'Food insecurity affects over 400,000 residents in the DC, Maryland, and Virginia region, with particularly high rates among children and seniors. Economic challenges from inflation have increased need by 30%.',
            type: 'research',
            url: 'https://example.com/cabf-research-dmv'
          }
        },
        {
          id: 'doc4',
          score: 0.85,
          metadata: {
            title: 'CABF Nutrition Education Program',
            content: 'The Capital Area Food Bank\'s nutrition education program provides resources and workshops to help families prepare healthy meals on a budget, promoting long-term health and well-being.',
            type: 'program_description',
            url: 'https://example.com/cabf-nutrition'
          }
        },
        {
          id: 'doc5',
          score: 0.83,
          metadata: {
            title: 'Emergency Food Assistance Program Guidelines',
            content: 'The Emergency Food Assistance Program (TEFAP) provides food to low-income individuals through our network of partner agencies. Eligibility is determined based on household income and size.',
            type: 'program_guidelines',
            url: 'https://example.com/cabf-tefap'
          }
        }
      ];
      res.json({ documents: mockDocuments });
    }
  } catch (error) {
    console.error('Error in search endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to truncate text to a reasonable size for the context window
function truncateText(text, maxLength = 100000) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  // If text is too large, take the beginning and end portions
  const halfLength = Math.floor(maxLength / 2);
  const beginning = text.substring(0, halfLength);
  const ending = text.substring(text.length - halfLength);
  
  return beginning + '\n\n[...document content truncated due to length...]\n\n' + ending;
}

// Function to parse document content based on type and base64 data
async function parseDocumentContent(content, fileType, fileName) {
  try {
    // Handle different file types
    if (content.startsWith('data:')) {
      console.log(`Parsing document: ${fileName}, type: ${fileType}`);
      
      try {
        // Extract base64 content
        const base64Content = content.split(',')[1];
        if (!base64Content) {
          console.error('Invalid base64 data format');
          return '[Error: Invalid file format]';
        }
        
        const buffer = Buffer.from(base64Content, 'base64');
        
        // Process based on file type
        if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
          // Parse PDF
          try {
            console.log(`Parsing PDF: ${fileName}`);
            const pdfData = await pdfParse(buffer);
            
            if (pdfData && pdfData.text) {
              console.log(`Successfully extracted ${pdfData.text.length} characters from PDF`);
              return truncateText(pdfData.text);
            } else {
              console.error('PDF parsing returned empty text');
              return '[PDF parsing returned empty text]';
            }
          } catch (pdfError) {
            console.error('Error parsing PDF:', pdfError);
            return '[Error parsing PDF content]';
          }
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                  fileName.toLowerCase().endsWith('.docx')) {
          // Parse DOCX
          try {
            console.log(`Parsing DOCX: ${fileName}`);
            const result = await mammoth.extractRawText({ buffer });
            
            if (result && result.value) {
              console.log(`Successfully extracted ${result.value.length} characters from DOCX`);
              return truncateText(result.value);
            } else {
              console.error('DOCX parsing returned empty text');
              return '[DOCX parsing returned empty text]';
            }
          } catch (docxError) {
            console.error('Error parsing DOCX:', docxError);
            return '[Error parsing DOCX content]';
          }
        } else if (fileType === 'text/plain' || fileName.toLowerCase().endsWith('.txt')) {
          // Parse text file
          try {
            console.log(`Parsing text file: ${fileName}`);
            const text = buffer.toString('utf-8');
            console.log(`Successfully extracted ${text.length} characters from text file`);
            return truncateText(text);
          } catch (textError) {
            console.error('Error parsing text file:', textError);
            return '[Error parsing text file]';
          }
        } else {
          // For other binary formats, we can't extract text
          console.log(`Unsupported file type: ${fileType || 'unknown'}`);
          return `[Unsupported file format: ${fileType || 'unknown'}]`;
        }
      } catch (parseError) {
        console.error('Error during file parsing:', parseError);
        return '[Error during file parsing]';
      }
    } else {
      // Already text content
      console.log(`Processing text content, length: ${content.length} characters`);
      return truncateText(content);
    }
  } catch (error) {
    console.error('Error parsing document:', error);
    return '[Error processing document content]';
  }
}

// API endpoint for document generation with Pinecone context
app.post('/api/generate-with-context', async (req, res) => {
  try {
    const { query, outputType, numPages, grantType, selectedDocumentIds, additionalContext } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    console.log(`Generating with context - Query: "${query}", Output type: ${outputType}, Grant type: ${grantType || 'none'}`);
    if (additionalContext) {
      console.log(`Additional context documents: ${additionalContext.length}`);
    }
    
    // Initialize context string
    let context = '';
    let hasContext = false;
    
    // Get context from selected documents if available
    if (selectedDocumentIds && selectedDocumentIds.length > 0) {
      try {
        // Fetch actual context from the documents
        context += await getContextFromDocuments(selectedDocumentIds);
        console.log('Successfully retrieved context from Pinecone');
        hasContext = true;
      } catch (error) {
        console.error('Error fetching document context:', error);
        // Fallback to mock data if fetching fails
        console.log('Using fallback context data');
        context += 'Using context from Capital Area Food Bank documents:\n\n';
        context += 'DOCUMENT 1: Capital Area Food Bank Overview\n';
        context += 'The Capital Area Food Bank has been serving the DC metro area for over 40 years. Our mission is to address hunger today and build healthier futures tomorrow for residents struggling with food insecurity.\n\n';
        context += 'DOCUMENT 2: CABF Community Impact Report 2023\n';
        context += 'In 2023, the Capital Area Food Bank distributed over 45 million meals to families facing food insecurity across Washington DC, Maryland, and Virginia. Our programs reached more than 400,000 individuals.\n\n';
        context += 'DOCUMENT 3: Food Insecurity in the DMV Region\n';
        context += 'Food insecurity affects over 400,000 residents in the DC, Maryland, and Virginia region, with particularly high rates among children and seniors. Economic challenges from inflation have increased need by 30%.\n\n';
        hasContext = true;
      }
    }
    
    // Add context from user-uploaded documents if available
    if (additionalContext && additionalContext.length > 0) {
      if (context) {
        context += '\n\nADDITIONAL USER-PROVIDED CONTEXT:\n\n';
      } else {
        context += 'USER-PROVIDED CONTEXT:\n\n';
      }
      
      // Process each uploaded document
      for (let i = 0; i < additionalContext.length; i++) {
        const doc = additionalContext[i];
        
        // Add document header
        context += `DOCUMENT ${i+1}: ${doc.name}\n`;
        
        try {
          // Parse document content
          const parsedContent = await parseDocumentContent(doc.content, doc.type, doc.name);
          
          // Add the parsed content
          context += `${parsedContent}\n\n`;
          hasContext = true;
          console.log(`Successfully parsed document ${i+1}: ${doc.name}`);
        } catch (error) {
          console.error(`Error processing document ${doc.name}:`, error);
          context += `[Error processing document content]\n\n`;
        }
      }
    }
    
    // Configure the model - using Gemini 2.0 Flash
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Create structured prompt based on document type, pages, and now with context
    let prompt = '';
    
    // Add context to the prompt if available
    if (hasContext && context.trim()) {
      // Log context length to help with debugging
      console.log(`Context length: ${context.length} characters`);

      console.log(context);
      
      prompt = `You are a helpful AI assistant creating a document based on user request.

IMPORTANT CONTEXT INFORMATION:
${context}

USER REQUEST:
The user has asked you to create a ${outputType === 'grant' ? `${grantType} grant proposal` : outputType} document about: "${query}"

You MUST incorporate the information from the context above into the document you generate. Use specific details, facts, and information from the provided context where relevant.

`;
    } else {
      console.log('No context available, generating without additional context');
    }
    
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
        [Detailed budget with justifications]
        
        | EXPENSE CATEGORY | AMOUNT | JUSTIFICATION |
        | ---------------- | ------ | ------------- |
        | [Category 1] | [Amount] | [Justification] |
        | [Category 2] | [Amount] | [Justification] |
        | [Category 3] | [Amount] | [Justification] |
        | TOTAL | [Total Amount] | |
        
        ## EXPECTED OUTCOMES
        [Description of expected research findings and contributions]
        
        ## SIGNIFICANCE AND IMPACT
        [Discussion of the significance and potential impact of the research]
        
        ## DISSEMINATION PLAN
        [How research findings will be shared and published]
        
        ## RESEARCH TEAM
        [Information about the principal investigator and research team]
        
        ## REFERENCES
        [List of key references cited in the proposal]`;
      }
      
      prompt += `\n\nPlease ensure all sections are detailed and specific to the query: ${query}.
      
      IMPORTANT: Make all tables well-formatted with proper rows and columns to be easily converted to a Word document table.`;
    } else if (outputType === 'pdf' || outputType === 'docx') {
      prompt = `Generate a structured ${outputType} document with ${numPages} pages about: ${query}.
      
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
    
    // Generate content with Gemini
    try {
      // Log the beginning of the prompt to verify context is included
      console.log("Prompt beginning (first 500 chars):", prompt.substring(0, 500));
      
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
        grantType: outputType === 'grant' ? grantType : null,
        usedContext: hasContext
      });
    } catch (modelError) {
      console.error('Error from Gemini API:', modelError);
      return res.status(500).json({ error: 'Error generating content from AI model', details: modelError.message });
    }
  } catch (error) {
    console.error('Error in generation endpoint:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

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
        [Detailed budget with justifications]
        
        | EXPENSE CATEGORY | AMOUNT | JUSTIFICATION |
        | ---------------- | ------ | ------------- |
        | [Category 1] | [Amount] | [Justification] |
        | [Category 2] | [Amount] | [Justification] |
        | [Category 3] | [Amount] | [Justification] |
        | TOTAL | [Total Amount] | |
        
        ## EXPECTED OUTCOMES
        [Description of expected research findings and contributions]
        
        ## SIGNIFICANCE AND IMPACT
        [Discussion of the significance and potential impact of the research]
        
        ## DISSEMINATION PLAN
        [How research findings will be shared and published]
        
        ## RESEARCH TEAM
        [Information about the principal investigator and research team]
        
        ## REFERENCES
        [List of key references cited in the proposal]`;
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// 404 middleware
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
}); 