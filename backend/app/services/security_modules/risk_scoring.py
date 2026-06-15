class RiskScoringService:
    SEVERITY_BASE = {
        "Low": 10,
        "Medium": 30,
        "High": 50,
        "Critical": 70
    }

    @staticmethod
    def calculate_risk_score(severity: str, attack_success: bool, confidence: float) -> int:
        score = RiskScoringService.SEVERITY_BASE.get(severity, 20)

        if attack_success:
            score += 25 # Penalty for successful bypass

        # Adjust slightly based on evaluator confidence
        score += int(confidence * 10)

        return min(score, 100)

    @staticmethod
    def score_to_severity(score: int) -> str:
        if score <= 30: return "Low"
        if score <= 60: return "Medium"
        if score <= 80: return "High"
        return "Critical"