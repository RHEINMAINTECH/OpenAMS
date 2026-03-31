from typing import Any, Dict, List, Tuple
import json

def validate_record_data(schema: Dict[str, Any], data: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Validiert Daten gegen ein definiertes Schema.
    Schema-Format: {"fields": [{"name": "...", "type": "string|integer|boolean|array|object", "required": bool}]}
    """
    fields = schema.get("fields", [])
    if not fields:
        # Wenn kein Schema definiert ist, erlauben wir keine Daten (Inkonsistenz-Schutz)
        if data:
            return False, "Kein Schema für diese Datenstruktur definiert. Bitte definieren Sie zuerst Felder im Schema."
        return True, ""

    allowed_types = {
        "string": str,
        "integer": int,
        "boolean": bool,
        "array": list,
        "object": dict,
        "float": (int, float)
    }

    errors = []
    
    # 1. Check required fields and types
    for field in fields:
        name = field.get("name")
        f_type = field.get("type", "string")
        required = field.get("required", False)
        
        if name not in data:
            if required:
                errors.append(f"Pflichtfeld '{name}' fehlt.")
            continue
            
        val = data[name]
        
        # Null-Werte Check
        if val is None:
            if required:
                errors.append(f"Pflichtfeld '{name}' darf nicht leer (null) sein.")
            continue

        # Typ-Validierung
        expected_type = allowed_types.get(f_type)
        if expected_type and not isinstance(val, expected_type):
            errors.append(f"Feld '{name}' hat den falschen Typ. Erwartet: {f_type}, Erhalten: {type(val).__name__}.")

    # 2. Check for unknown fields (strict mode)
    schema_field_names = {f.get("name") for f in fields}
    for key in data.keys():
        if key not in schema_field_names:
            errors.append(f"Unbekanntes Feld '{key}' in den Daten gefunden. Nur definierte Felder sind erlaubt.")

    if errors:
        return False, "Validierungsfehler: " + " ".join(errors)
    
    return True, ""







