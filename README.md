# AI Document Generator

A web application that generates different types of documents (PDF, DOCX, PowerPoint, social media posts, grant proposals) based on user queries using Google's Gemini 1.5 Flash model.

## Features

- Generate structured document content based on user queries
- Support for different output formats (PDF, DOCX, PowerPoint, Grant Proposals, Twitter, Instagram)
- Specify number of pages or slides
- Real-time content generation with Gemini 1.5 Flash AI model
- Format-specific structured output for each document type

## Structured Output by Format

The application provides tailored structured content for each document type:

- **PDF/DOCX**: Properly formatted with title, introduction, main sections, and conclusion
- **PowerPoint**: Slide-by-slide content with titles and bullet points
- **Grant Proposal**: Comprehensive structure with executive summary, organization background, problem statement, project description, timeline, budget, expected outcomes, evaluation plan, sustainability, and conclusion
- **Twitter/X**: Post content, relevant hashtags, and engagement prompts
- **Instagram**: Formatted caption with storytelling elements and hashtags

## Setup Instructions

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up your Gemini API key:
   - Get an API key from Google AI Studio (https://makersuite.google.com/)
   - Create a `.env` file in the root directory by copying `.env.example`:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```

4. Start the server:
   ```
   npm start
   ```
   
   For development with automatic restarts:
   ```
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Select the output format (PDF, DOCX, PPT, Twitter/X, Instagram)
2. Specify the number of pages/slides you need (for documents/presentations)
3. Enter your query for document generation
4. Click "Generate Document"
5. View the structured generated content formatted appropriately for your selection

## Technologies Used

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- AI: Google Gemini 1.5 Flash

## License

MIT 