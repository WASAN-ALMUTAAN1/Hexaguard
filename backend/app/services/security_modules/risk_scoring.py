class RiskScoringService:
    @staticmethod
    def calculate_risk_score(severity: str, attack_success: bool, confidence: float) -> int:
        severity = (severity or "Low").title()

        if not attack_success:
            return 0

        base_scores = {
            "Low": 30,
            "Medium": 50,
            "High": 80,
            "Critical": 90,
        }

        score = base_scores.get(severity, 50)
        score += int((confidence or 0.5) * 10)

        return min(score, 100)

    @staticmethod
    def score_to_severity(score: int) -> str:
        if score >= 90:
            return "Critical"
        if score >= 70:
            return "High"
        if score >= 40:
            return "Medium"
        return "Low"