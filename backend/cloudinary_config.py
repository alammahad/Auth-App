"""Cloudinary configuration for image uploads."""

import os
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

load_dotenv()

# Configure Cloudinary with environment variables
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)


def upload_image(file_bytes: bytes, folder: str) -> str:
    """
    Upload image bytes to Cloudinary and return the secure URL.
    
    Args:
        file_bytes: Image file content as bytes
        folder: Cloudinary folder path (e.g., "schlr/profiles" or "schlr/posts")
    
    Returns:
        str: Secure HTTPS URL of the uploaded image
    
    Raises:
        Exception: If upload fails
    """
    try:
        result = cloudinary.uploader.upload(
            file_bytes,
            folder=folder,
            resource_type="image",
        )
        secure_url = result.get("secure_url")
        if not secure_url:
            raise Exception("Cloudinary upload failed: no secure_url in response")
        return secure_url
    except Exception as e:
        raise Exception(f"Cloudinary upload error: {str(e)}")
