# File: backend/app/services/security_modules/rag_testing.py

class RAGSecurityModule:
    @staticmethod
    def inject_malicious_payload(documents: list, malicious_payload: str) -> list:
        """
        Simulates 'Context Poisoning' by injecting malicious instructions 
        into the retrieved context.
        """
        poisoned_docs = documents.copy()
        # Append the malicious payload as a 'poisoned' document
        if malicious_payload:
            poisoned_docs.append({
                "content": malicious_payload, 
                "metadata": {"source": "malicious_injection"}
            })
        return poisoned_docs

    @staticmethod
    def verify_extraction(response: str, sensitive_payload: str) -> bool:
        """
        Check if the LLM output contains the injected sensitive data.
        """
        if not sensitive_payload:
            return False
        return sensitive_payload.lower() in response.lower()