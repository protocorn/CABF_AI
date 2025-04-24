from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
from sentence_transformers import SentenceTransformer
import os
import numpy as np
from dotenv import load_dotenv
import logging
from pinecone import Pinecone

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize SentenceTransformer model with CLIP
device = "cuda" if torch.cuda.is_available() else "cpu"
logger.info(f"Using device: {device}")
clip_model = SentenceTransformer('clip-ViT-B-32-multilingual-v1', device=device)

# Initialize Pinecone
pinecone_api_key = os.getenv("PINECONE_API_KEY")
pinecone_index_name = os.getenv("PINECONE_INDEX_NAME", "cafbai")

logger.info(f"Connecting to Pinecone index: {pinecone_index_name}")
pc = Pinecone(api_key=pinecone_api_key)
index = pc.Index(pinecone_index_name)
logger.info(f"Connected to Pinecone index: {pinecone_index_name}")

@app.route('/query-pinecone', methods=['POST'])
def query_pinecone():
    try:
        data = request.json
        query = data.get('query')
        top_k = data.get('topK', 5)
        content_type = data.get('contentType', 'all')
        
        if not query:
            logger.error("No query provided")
            return jsonify({"error": "No query provided"}), 400
        
        logger.info(f"Processing query: '{query}', topK: {top_k}, contentType: {content_type}")
        
        # Generate embedding for the query using SentenceTransformer
        query_embedding = clip_model.encode(query, convert_to_numpy=True).tolist()
        
        # Resize embedding to match Pinecone's dimension requirements if needed
        # Determine the embedding dimension (usually 512 or 768)
        embedding_dimension = len(query_embedding)
        logger.info(f"Generated embedding with dimension: {embedding_dimension}")
        
        # Prepare Pinecone query parameters
        query_params = {
            "vector": query_embedding,
            "top_k": top_k,
            "include_metadata": True,
            "namespace": ""  # Use default namespace
        }
        
        # Add type filter if specified
        if content_type and content_type != 'all':
            # Adjust filter based on the actual metadata structure in Pinecone
            # Your sample shows 'type' field, not 'content_type'
            query_params["filter"] = {"type": content_type}
            logger.info(f"Added filter for type: {content_type}")
        
        # Execute query - let's try to be more verbose for debugging
        logger.info(f"Executing Pinecone query with parameters: top_k={top_k}, includes_filter={content_type != 'all'}")
        query_result = index.query(**query_params)
        
        # Log actual query result details
        num_matches = len(query_result.matches) if hasattr(query_result, 'matches') else 0
        logger.info(f"Pinecone returned {num_matches} matches")
        
        # Format results
        results = []
        if hasattr(query_result, 'matches'):
            for match in query_result.matches:
                # Log each match for debugging
                logger.debug(f"Match ID: {match.id}, Score: {match.score}")
                
                # Ensure metadata exists
                metadata = match.metadata if hasattr(match, 'metadata') else {}
                
                results.append({
                    "id": match.id,
                    "score": float(match.score),
                    "metadata": metadata
                })
        
        logger.info(f"Found {len(results)} results")
        
        # If no results, log a more detailed message
        if len(results) == 0:
            logger.warning(f"No results found for query: '{query}'. This could indicate a problem with embeddings, index content, or filter settings.")
        
        return jsonify({"results": results})
    
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Attempt to get index stats to verify connectivity
        stats = index.describe_index_stats()
        vector_count = stats.total_vector_count if hasattr(stats, 'total_vector_count') else 'unknown'
        return jsonify({
            "status": "ok", 
            "message": "Pinecone service is running",
            "index_name": pinecone_index_name,
            "vector_count": vector_count
        })
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/debug-index', methods=['GET'])
def debug_index():
    """Debug endpoint to check index contents"""
    try:
        stats = index.describe_index_stats()
        return jsonify({
            "index_name": pinecone_index_name,
            "stats": stats.__dict__ if hasattr(stats, '__dict__') else str(stats)
        })
    except Exception as e:
        logger.error(f"Index debug failed: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/query-documents', methods=['POST'])
def query_documents():
    """Specialized endpoint for querying document content based on the actual structure"""
    try:
        data = request.json
        query = data.get('query')
        top_k = data.get('topK', 10)
        
        if not query:
            logger.error("No query provided")
            return jsonify({"error": "No query provided"}), 400
        
        logger.info(f"Processing document query: '{query}', topK: {top_k}")
        
        # Generate embedding for the query
        query_embedding = clip_model.encode(query, convert_to_numpy=True).tolist()
        embedding_dimension = len(query_embedding)
        logger.info(f"Generated embedding with dimension: {embedding_dimension}")
        
        # Set up the query parameters specifically for documents
        # Based on your sample document structure
        query_params = {
            "vector": query_embedding,
            "top_k": top_k,
            "include_metadata": True,
            "filter": {
                "type": "document"  # Filter specifically for document type
            }
        }
        
        # Execute the query
        logger.info(f"Executing document query")
        query_result = index.query(**query_params)
        
        # Format the results according to the actual document structure
        results = []
        if hasattr(query_result, 'matches'):
            for match in query_result.matches:
                metadata = match.metadata if hasattr(match, 'metadata') else {}
                
                # Create a document object based on the actual structure in your sample
                document = {
                    "id": match.id,
                    "score": float(match.score),
                    "metadata": {
                        "title": metadata.get('title', ''),
                        "text": metadata.get('text', ''),
                        "date": metadata.get('date', ''),
                        "filename": metadata.get('filename', ''),
                        "type": metadata.get('type', 'document'),
                        "page_count": metadata.get('page_count', 0),
                        "word_count": metadata.get('word_count', 0)
                    }
                }
                
                # Add content to make it compatible with existing code
                document["title"] = metadata.get('title', '')
                document["content"] = metadata.get('text', '')
                
                results.append(document)
        
        logger.info(f"Found {len(results)} document results")
        
        return jsonify({"documents": results})
    
    except Exception as e:
        logger.error(f"Error processing document query: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route('/query-images', methods=['POST'])
def query_images():
    """Specialized endpoint for querying images based on the provided structure"""
    try:
        data = request.json
        query = data.get('query')
        top_k = data.get('topK', 10)
        
        if not query:
            logger.error("No query provided")
            return jsonify({"error": "No query provided"}), 400
        
        logger.info(f"Processing image query: '{query}', topK: {top_k}")
        
        # Generate embedding for the query
        query_embedding = clip_model.encode(query, convert_to_numpy=True).tolist()
        embedding_dimension = len(query_embedding)
        logger.info(f"Generated embedding with dimension: {embedding_dimension}")
        
        # Set up the query parameters specifically for images
        query_params = {
            "vector": query_embedding,
            "top_k": top_k,
            "include_metadata": True,
            "filter": {
                "type": "image"  # Filter specifically for image type
            }
        }
        
        # Execute the query
        logger.info(f"Executing image query")
        query_result = index.query(**query_params)
        
        # Format the results according to the actual image structure
        results = []
        if hasattr(query_result, 'matches'):
            for match in query_result.matches:
                metadata = match.metadata if hasattr(match, 'metadata') else {}
                
                # Create an image object based on the structure provided
                image = {
                    "id": match.id,
                    "score": float(match.score),
                    "metadata": {
                        "image_url": metadata.get('image_url', ''),
                        "filename": metadata.get('filename', ''),
                        "image_type": metadata.get('image_type', ''),
                        "image_classification": metadata.get('image_classification', 'image'),
                        "original_pdf": metadata.get('original_pdf', ''),
                        "page_number": metadata.get('page_number', 0),
                        "text": metadata.get('text', ''),
                        "type": metadata.get('type', 'image')
                    }
                }
                
                # Add imageUrl field to make it compatible with existing frontend code
                image["imageUrl"] = metadata.get('image_url', '')
                
                # Add content and title to make it compatible with document structure
                filename = metadata.get('filename', '')
                # Remove file extension to create title
                if '.' in filename:
                    title = filename.rsplit('.', 1)[0]
                else:
                    title = filename
                    
                image["title"] = title or 'Image'
                image["content"] = metadata.get('text', 'No description available')
                image["type"] = "image"
                
                results.append(image)
        
        logger.info(f"Found {len(results)} image results")
        
        return jsonify({"images": results})
    
    except Exception as e:
        logger.error(f"Error processing image query: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv("FLASK_PORT", 5000))
    logger.info(f"Starting Flask server on port {port}")
    logger.info(f"API will be available at http://localhost:{port}")
    logger.info(f"Health check endpoint available at http://localhost:{port}/health")
    logger.info(f"Debug endpoint available at http://localhost:{port}/debug-index")
    app.run(debug=True, host='0.0.0.0', port=port) 