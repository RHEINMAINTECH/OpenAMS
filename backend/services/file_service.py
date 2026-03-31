import os
import io
import datetime
import logging
from sqlalchemy.orm import Session
from backend.config import settings
from backend.database.models import FileAsset
from backend.services import audit_service, memory_service

logger = logging.getLogger(__name__)

def save_uploaded_file(tenant_id: int, filename: str, content: bytes) -> str:
    tenant_dir = os.path.join(settings.UPLOAD_DIR, str(tenant_id))
    os.makedirs(tenant_dir, exist_ok=True)
    ts = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_name = f"{ts}_{filename}"
    filepath = os.path.join(tenant_dir, safe_name)
    with open(filepath, "wb") as f:
        f.write(content)
    return filepath

def _extract_text_pymupdf(filepath: str) -> tuple[str, int]:
    import fitz
    doc = fitz.open(filepath)
    pages = len(doc)
    text_parts = []
    for page in doc:
        page_text = page.get_text("text")
        text_parts.append(page_text)
    doc.close()
    return "\n".join(text_parts), pages

def _ocr_pdf(filepath: str) -> tuple[str, int]:
    import fitz
    from PIL import Image
    import pytesseract
    doc = fitz.open(filepath)
    pages = len(doc)
    text_parts = []
    for page_num in range(pages):
        page = doc[page_num]
        pix = page.get_pixmap(dpi=300)
        img_bytes = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_bytes))
        try:
            text = pytesseract.image_to_string(img, lang="deu+eng")
        except:
            text = pytesseract.image_to_string(img)
        text_parts.append(text)
    doc.close()
    return "\n".join(text_parts), pages

def extract_text(filepath: str, mime_type: str, pdf_strategy: str = "auto", image_strategy: str = "ocr") -> tuple[str, int, str]:
    text, pages, method = "", 0, "none"
    
    if mime_type.startswith("application/pdf"):
        if pdf_strategy == "ignore":
            return "", 0, "none"
            
        if pdf_strategy in ["auto", "text"]:
            try:
                text, pages = _extract_text_pymupdf(filepath)
                method = "pymupdf"
            except: pass

        meaningful_len = len(" ".join((text or "").strip().split()))
        
        if pdf_strategy == "ocr" or (pdf_strategy == "auto" and pages > 0 and meaningful_len < (50 * max(pages, 1))):
            try:
                ocr_text, ocr_pages = _ocr_pdf(filepath)
                if pdf_strategy == "ocr" or len(" ".join(ocr_text.strip().split())) > meaningful_len:
                    return ocr_text.strip(), ocr_pages, "ocr"
            except: pass

        return text.strip(), pages, method
        
    elif mime_type.startswith("image/"):
        if image_strategy == "ignore":
            return "", 0, "none"
        elif image_strategy == "vision":
            return "", 1, "vision"
        elif image_strategy == "ocr":
            try:
                from PIL import Image
                import pytesseract
                img = Image.open(filepath)
                text = pytesseract.image_to_string(img, lang="deu+eng")
                method = "ocr"
                return text.strip(), 1, method
            except: pass

    return "", 0, "none"

def create_file_asset(db: Session, tenant_id: int, filename: str, content: bytes, mime_type: str, pdf_strategy: str = "auto", image_strategy: str = "ocr") -> FileAsset:
    filepath = save_uploaded_file(tenant_id, filename, content)
    extracted_text, page_count, extraction_method = extract_text(filepath, mime_type, pdf_strategy, image_strategy)

    asset = FileAsset(
        tenant_id=tenant_id,
        filename=filename,
        filepath=filepath,
        mime_type=mime_type,
        extracted_text=extracted_text,
        page_count=page_count,
        metadata_json={
            "extraction_method": extraction_method,
            "text_length": len(extracted_text)
        }
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    
    audit_service.log_action(db, tenant_id, "file.uploaded", "file_asset", asset.id, details={"filename": filename})
    return asset








