"""Export renderers for CSV, Excel, and PDF report downloads."""

from __future__ import annotations

import csv
from io import BytesIO, StringIO

from openpyxl import Workbook
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


def render_summary_export(export_format: str, report_type: str, summary: dict, rows: list | None = None):
    rows = rows or []
    ext = "xlsx" if export_format == "excel" else export_format
    filename = f"hexaattender_{report_type}_report.{ext}"

    if export_format == "csv":
        out = StringIO()
        writer = csv.writer(out)
        writer.writerow(["Metric", "Value"])
        for key, value in summary.items():
            writer.writerow([key, value])
        if rows:
            writer.writerow([])
            writer.writerow(
                ["Roll No", "Name", "Department", "Semester", "Total", "Present", "Absent", "Attendance %"]
            )
            for row in rows:
                writer.writerow(
                    [
                        row.get("roll_no"),
                        row.get("name"),
                        row.get("department"),
                        row.get("semester"),
                        row.get("total") or row.get("summary", {}).get("total_periods"),
                        row.get("present") or row.get("summary", {}).get("present_count"),
                        row.get("absent") or row.get("summary", {}).get("absent_count"),
                        row.get("attendance_percentage"),
                    ]
                )
        return {
            "filename": filename,
            "content_type": "text/csv",
            "bytes": out.getvalue().encode("utf-8"),
        }

    if export_format == "excel":
        wb = Workbook()
        ws = wb.active
        ws.title = report_type.title()
        ws.append(["Metric", "Value"])
        for key, value in summary.items():
            ws.append([key, value])
        if rows:
            ws.append([])
            ws.append(
                ["Roll No", "Name", "Department", "Semester", "Total", "Present", "Absent", "Attendance %"]
            )
            for row in rows:
                ws.append(
                    [
                        row.get("roll_no"),
                        row.get("name"),
                        row.get("department"),
                        row.get("semester"),
                        row.get("total") or row.get("summary", {}).get("total_periods"),
                        row.get("present") or row.get("summary", {}).get("present_count"),
                        row.get("absent") or row.get("summary", {}).get("absent_count"),
                        row.get("attendance_percentage"),
                    ]
                )
        data = BytesIO()
        wb.save(data)
        return {
            "filename": filename,
            "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "bytes": data.getvalue(),
        }

    data = BytesIO()
    pdf = canvas.Canvas(data, pagesize=letter)
    y = 750
    pdf.drawString(72, y, f"HexaAttender {report_type.title()} Report")
    for key, value in summary.items():
        y -= 18
        pdf.drawString(72, y, f"{key}: {value}")
    if rows:
        y -= 25
        pdf.drawString(72, y, "Detail rows:")
        for row in rows[:40]:
            y -= 14
            if y < 80:
                pdf.showPage()
                y = 750
            pdf.drawString(
                72,
                y,
                f"{row.get('roll_no', '')} | {row.get('name', '')} | {row.get('attendance_percentage', '')}%",
            )
    pdf.save()
    return {"filename": filename, "content_type": "application/pdf", "bytes": data.getvalue()}
