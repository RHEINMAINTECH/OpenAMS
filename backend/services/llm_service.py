import httpx
import time
import json
import datetime
from backend.config import settings
from sqlalchemy.orm import Session
from backend.database.models import Setting, LLMLog


def _get_provider_config(db: Session, model_name: str):
    """Ermittelt API-URL und Key basierend auf dem Modellnamen durch Prüfung der Modell-Listen."""
    provider = "wilma" # Fallback
    
    # Durchsuche die gespeicherten Modell-Listen in der DB
    for p in ["wilma", "openai", "anthropic"]:
        row = db.query(Setting).filter(Setting.key == f"{p}_models", Setting.tenant_id.is_(None)).first()
        if row and row.value_json and "models" in row.value_json:
            ids = [m["id"] for m in row.value_json["models"]]
            if model_name in ids:
                provider = p
                break
    else:
        # Fallback auf Prefix-Mapping falls nicht in Listen (Legacy/Migration)
        if model_name.startswith("gpt-"): provider = "openai"
        elif model_name.startswith("claude-"): provider = "anthropic"

    url_key = f"{provider}_api_url"
    key_key = f"{provider}_api_key"

    url_row = db.query(Setting).filter(Setting.key == url_key, Setting.tenant_id.is_(None)).first()
    key_row = db.query(Setting).filter(Setting.key == key_key, Setting.tenant_id.is_(None)).first()

    # Fallbacks auf config.settings (env) falls DB leer oder fehlt
    url = url_row.value_json.get("value", "") if url_row else ""
    key = key_row.value_json.get("value", "") if key_row else ""

    if not url and provider == "wilma":
        url = settings.WILMA_API_URL
    if not key and provider == "wilma":
        key = settings.WILMA_API_KEY

    return {
        "provider": provider,
        "url": url,
        "key": key,
    }

def _get_default_model_config(db: Session):
    model_row = db.query(Setting).filter(Setting.key == "wilma_default_model", Setting.tenant_id.is_(None)).first()
    temp_row = db.query(Setting).filter(Setting.key == "wilma_default_temperature", Setting.tenant_id.is_(None)).first()
    return {
        "model": model_row.value_json.get("value", settings.WILMA_DEFAULT_MODEL) if model_row else settings.WILMA_DEFAULT_MODEL,
        "temperature": temp_row.value_json.get("value", settings.WILMA_DEFAULT_TEMPERATURE) if temp_row else settings.WILMA_DEFAULT_TEMPERATURE,
    }

async def chat_completion(
    db: Session,
    messages: list[dict],
    model: str = None,
    temperature: float = None,
    stream: bool = False,
    tools: list[dict] = None,
    return_raw_message: bool = False,
):
    defaults = _get_default_model_config(db)
    use_model = model or defaults["model"]
    use_temp = temperature if temperature is not None else defaults["temperature"]

    cfg = _get_provider_config(db, use_model)
    api_url = cfg["url"]
    api_key = cfg["key"]

    if not api_key:
        err_msg = f"[FEHLER] Kein API-Key für Provider '{cfg['provider']}' konfiguriert."
        return {"role": "assistant", "content": err_msg} if return_raw_message else err_msg

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    # Provider-spezifische Anpassungen
    if cfg["provider"] == "anthropic":
        headers["x-api-key"] = api_key
        headers["anthropic-version"] = "2023-06-01"
        del headers["Authorization"]
        
        # Anthropic erwartet 'system' als separates Feld, nicht in Messages
        system_msg = next((m["content"] for m in messages if m["role"] == "system"), None)
        
        chat_messages = []
        for m in (msg for msg in messages if msg["role"] != "system"):
            if isinstance(m["content"], list):
                new_content = []
                for item in m["content"]:
                    if item["type"] == "text":
                        new_content.append(item)
                    elif item["type"] == "image_url":
                        url = item["image_url"]["url"]
                        if url.startswith("data:"):
                            mime, b64data = url[5:].split(";", 1)
                            b64data = b64data.replace("base64,", "")
                            new_content.append({
                                "type": "image",
                                "source": {"type": "base64", "media_type": mime, "data": b64data}
                            })
                chat_messages.append({"role": m["role"], "content": new_content})
            else:
                chat_messages.append(m)
        
        payload = {
            "model": use_model,
            "messages": chat_messages,
            "max_tokens": 4096,
            "temperature": use_temp,
        }
        if system_msg:
            payload["system"] = system_msg
    else:
        # OpenAI & Wilma (OpenAI kompatibel)
        payload = {
            "model": use_model,
            "messages": messages,
            "temperature": use_temp,
            "stream": False,
        }

    if tools and cfg["provider"] != "anthropic":
        payload["tools"] = tools

    start_time = time.time()
    
    # RAW LOGGING: Sicherung des Payloads vor dem Absenden
    raw_payload_str = json.dumps(payload, ensure_ascii=False)
    resp_log_data = None
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(api_url, json=payload, headers=headers)
            
            # Erfassen der Antwort für das Log, unabhängig vom HTTP-Status
            try:
                resp_json = resp.json()
                resp_log_data = resp_json
            except:
                resp_log_data = {
                    "http_status": resp.status_code,
                    "http_reason": resp.reason_phrase,
                    "raw_body": resp.text[:100000] # Erste 100k Zeichen sichern
                }

            resp.raise_for_status()
            
            if cfg["provider"] == "anthropic":
                content = resp_json["content"][0]["text"] if resp_json.get("content") else ""
                msg = {"role": "assistant", "content": content}
            else:
                msg = resp_json["choices"][0]["message"]
            
            if return_raw_message:
                return msg
            return msg.get("content", "")
            
    except Exception as e:
        if resp_log_data is None:
            resp_log_data = {"exception": str(e), "detail": "Keine Server-Antwort erhalten (Timeout/DNS/Netzwerk)"}
        raise e
    finally:
        duration = int((time.time() - start_time) * 1000)
        try:
            # Protokollierung in die Datenbank
            new_log = LLMLog(
                model=use_model,
                prompt_raw=raw_payload_str,
                response_raw=json.dumps(resp_log_data, ensure_ascii=False),
                duration_ms=duration,
                created_at=datetime.datetime.utcnow()
            )
            db.add(new_log)
            db.commit()
        except Exception as log_err:
            import logging
            logging.getLogger("uvicorn.error").error(f"Kritischer Logging-Fehler: {log_err}")


async def test_connection(db: Session) -> dict:
    try:
        result = await chat_completion(
            db,
            messages=[
                {"role": "system", "content": "Du bist ein Test-Assistent."},
                {"role": "user", "content": "Antworte mit: Verbindung erfolgreich."},
            ],
        )
        return {"success": True, "response": result}
    except Exception as e:
        return {"success": False, "error": str(e)}








