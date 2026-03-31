from abc import ABC, abstractmethod


class MCPModuleBase(ABC):
    name: str = ""
    slug: str = ""
    version: str = "1.0.0"
    description: str = ""

    @abstractmethod
    def get_capabilities(self) -> dict:
        return {"read": [], "write": []}

    def read(self, method: str, params: dict = None) -> dict:
        fn = getattr(self, f"read_{method}", None)
        if not fn:
            return {"error": f"Lesemethode '{method}' nicht implementiert"}
        return fn(params or {})

    def write(self, method: str, params: dict = None) -> dict:
        fn = getattr(self, f"write_{method}", None)
        if not fn:
            return {"error": f"Schreibmethode '{method}' nicht implementiert"}
        return fn(params or {})











