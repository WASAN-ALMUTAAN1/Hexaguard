class OwaspMapperService:
    FALLBACK_OWASP_MAP = {
        "Prompt Injection": "LLM01:2025 Prompt Injection",
        "Jailbreak": "LLM01:2025 Prompt Injection",
        "Sensitive Data Leakage": "LLM02:2025 Sensitive Information Disclosure",
        "System Prompt Leakage": "LLM07:2025 System Prompt Leakage",
        "Tool Misuse": "LLM06:2025 Excessive Agency",
        "Agent Misuse": "LLM06:2025 Excessive Agency",
        "RAG Injection": "LLM08:2025 Vector and Embedding Weaknesses",
        "Hallucination": "LLM09:2025 Misinformation",
        "Misinformation": "LLM09:2025 Misinformation",
        "Harmful Content": "AI-SAFETY: Harmful Content",
        "harmful_content": "AI-SAFETY: Harmful Content",
    }

    @staticmethod
    def map_to_owasp(category: str) -> str:
        if not category:
            return "Unmapped Risk"

        return OwaspMapperService.FALLBACK_OWASP_MAP.get(
            str(category).strip(),
            "Unmapped Risk",
        )