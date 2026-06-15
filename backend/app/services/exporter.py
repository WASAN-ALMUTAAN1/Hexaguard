from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

class ExporterService:
    @staticmethod
    def generate_pdf_report(campaign_id: str, results: list, filename: str):
        c = canvas.Canvas(filename, pagesize=letter)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(100, 750, f"Security Audit Report: {campaign_id}")
        
        c.setFont("Helvetica", 12)
        y = 700
        for res in results:
            c.drawString(100, y, f"Vulnerability: {res.get('vulnerability')}")
            c.drawString(100, y-20, f"Risk Score: {res.get('risk_score')}")
            y -= 50
        
        c.save()
        return filename