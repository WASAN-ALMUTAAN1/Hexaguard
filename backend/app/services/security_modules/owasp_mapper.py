class OwaspMapperService:
    OWASP_MAP = {
        "Prompt Injection": "LLM01:2025 Prompt Injection",
        "Jailbreak": "LLM01:2025 Prompt Injection",
        "Sensitive Data Leakage": "LLM02:2025 Sensitive Information Disclosure",
        "Supply Chain": "LLM03:2025 Supply Chain",
        "Data Poisoning": "LLM04:2025 Data and Model Poisoning",
        "Output Handling Risk": "LLM05:2025 Improper Output Handling",
        "Tool Misuse": "LLM06:2025 Excessive Agency",
        "Agent Misuse": "LLM06:2025 Excessive Agency",
        "System Prompt Leakage": "LLM07:2025 System Prompt Leakage",
        "RAG Injection": "LLM08:2025 Vector and Embedding Weaknesses",
        "Hallucination": "LLM09:2025 Misinformation",
        "Unbounded Consumption": "LLM10:2025 Unbounded Consumption"
    }

    @staticmethod
    def map_to_owasp(category: str) -> str:
        return OwaspMapperService.OWASP_MAP.get(category, "Unmapped Risk")