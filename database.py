
import os
import zipfile
import mimetypes
import torch
from pinecone import Pinecone, ServerlessSpec
import google.generativeai as genai
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

# ========== CONFIG ==========
ZIP_PATH = r"C:/Users/risha/source/repos/AI_Competition/images.zip"  # Path to your ZIP file
EXTRACT_DIR = r"C:/Users/risha/source/repos/AI_Competition/extracted_data2"
GEMINI_API_KEY = "AIzaSyAeeBtMkw34woasub1zacZipjX6FCqEgnQ"
PINECONE_API_KEY = "pcsk_42QEgC_FcqEmtTNfMVnpCk7simk4RXrMy7h69FGZZuCUXCi9J8m354tdkmh6wnTv5jL8gw"
PINECONE_ENV = "us-east-1"
PINECONE_INDEX_NAME = "cafb"

# ========== SETUP ==========
genai.configure(api_key=GEMINI_API_KEY)
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

pc = Pinecone(api_key=PINECONE_API_KEY)

# if PINECONE_INDEX_NAME not in pc.list_indexes().names():
#     pc.create_index(
#         name=PINECONE_INDEX_NAME,
#         dimension=512,
#         metric="cosine",
#         spec=ServerlessSpec(
#                 cloud='aws',
#                 region='us-east-1'
#             )
#     )
# else:
#     print(f"Index '{PINECONE_INDEX_NAME}' already exists.")

index = pc.Index(PINECONE_INDEX_NAME)

# ========== EMBEDDING FUNCTIONS ==========
# def get_text_embedding_clip(text):
#     inputs = clip_processor(text=[text], return_tensors="pt", padding=True, truncation=True)
#     with torch.no_grad():
#         embeddings = clip_model.get_text_features(**inputs)
#     return embeddings[0].cpu().numpy().tolist()

def get_image_embedding(image_path):
    image = Image.open(image_path).convert("RGB")
    inputs = clip_processor(images=image, return_tensors="pt")
    with torch.no_grad():
        embeddings = clip_model.get_image_features(**inputs)
    return embeddings[0].cpu().numpy().tolist()

# ========== PROCESS FUNCTIONS ==========
# def process_text_file(path, filename):
#     with open(path, 'r', encoding='utf-8', errors='ignore') as f:
#         text = f.read()
#     if not text.strip():
#         return
#     vec = get_text_embedding_clip(text)
#     index.upsert([(filename, vec, {"type": "text", "filename": filename, "group": "zip"})])

def process_image_file(path, filename):
    vec = get_image_embedding(path)
    index.upsert([(filename, vec, {"type": "image", "filename": filename, "group": "zip"})])

# ========== MAIN DRIVER ==========
def process_zip(zip_path):
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(EXTRACT_DIR)

    for root, _, files in os.walk(EXTRACT_DIR):
        for file in files:
            filepath = os.path.join(root, file)
            mime_type, _ = mimetypes.guess_type(filepath)

            try:
                if mime_type and mime_type.startswith("image"):
                    print(f"Processing image: {file}")
                    process_image_file(filepath, file)
                # if file.endswith(".txt") or (mime_type and mime_type.startswith("text")):
                #     print(f"Processing text: {file}")
                #     process_text_file(filepath, file)
                else:
                    print(f"Skipping unsupported file: {file}")
            except Exception as e:
                print(f"Error processing {file}: {e}")

if __name__ == "__main__":
    process_zip(ZIP_PATH)
    print("All data embedded and upserted to Pinecone.")
