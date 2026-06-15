class BlueTeamService:
    RECOMMENDATIONS = {
        "Prompt Injection": [
            "Separate system instructions from user-controlled input using delimiters (e.g., <user_input>).",
            "Implement input validation rules before passing data to the LLM.",
            "Apply output scanning to detect malicious artifacts before displaying them to the user."
        ],
        "System Prompt Leakage": [
            "Never place hardcoded secrets, API keys, or private IP addresses inside the system prompt.",
            "Add explicit refusal directives instructing the model to reject queries asking for 'previous instructions'.",
            "Monitor for repetitive meta-queries trying to extract operational guidelines."
        ]
    }

    @staticmethod
    def get_recommendations(attack_category: str) -> list[str]:
        return BlueTeamService.RECOMMENDATIONS.get(
            attack_category,
            ["Review the finding manually and implement strict input/output validation."]
        )