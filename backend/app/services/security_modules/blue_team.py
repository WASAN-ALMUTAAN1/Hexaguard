class BlueTeamService:
    RECOMMENDATIONS = {
        "Prompt Injection": [
            "Separate trusted system instructions from user input.",
            "Use prompt-injection filters before sending prompts to the model.",
            "Add output validation to detect instruction-following failures.",
        ],
        "System Prompt Leakage": [
            "Do not store secrets or credentials in system prompts.",
            "Add refusal rules for requests asking to reveal hidden instructions.",
            "Monitor repeated prompt-leakage attempts.",
        ],
        "RAG Injection": [
            "Treat retrieved documents as untrusted data.",
            "Wrap retrieved context in clear untrusted-context delimiters.",
            "Add source validation and context sanitization before retrieval.",
        ],
        "Tool Misuse": [
            "Apply least-privilege permissions for tools.",
            "Require human confirmation before destructive actions.",
            "Block dangerous tool calls server-side.",
        ],
        "Misinformation": [
            "Add factuality checks and source validation.",
            "Require citations for factual claims.",
            "Flag unsupported claims for human review.",
        ],
        "harmful_content": [
            "Apply safety classification before model execution.",
            "Use refusal policies for harmful requests.",
            "Monitor repeated harmful-content attempts.",
        ],
    }

    @staticmethod
    def get_recommendations(attack_category: str) -> list[str]:
        return BlueTeamService.RECOMMENDATIONS.get(
            attack_category,
            ["Review the finding manually and apply strict input/output validation."]
        )