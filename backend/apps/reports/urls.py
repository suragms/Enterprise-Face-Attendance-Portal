from django.urls import path
from .enterprise_views import ReportGenerateView, ReportHistoryListView, ReportMetaView
from .views import (
    DailyReportView,
    WeeklyReportView,
    MonthlyReportView,
    SemesterReportView,
    DepartmentReportView,
    FacultyReportView,
    StudentReportView,
    SubjectReportView,
    ExportCSVView,
    ExportExcelView,
    ExportPDFView,
    ExportTaskStatusView,
    ExportTaskDownloadView,
    AnalyticsDashboardView,
    AnalyticsTrendsView,
    AnalyticsDefaultersView,
    AnalyticsAlertsView,
    AnalyticsDepartmentView,
    AnalyticsSubjectView,
    AnalyticsHeatmapView,
    AnalyticsOverviewView,
)

urlpatterns = [
    path('meta/', ReportMetaView.as_view(), name='report_meta'),
    path('generate/', ReportGenerateView.as_view(), name='report_generate'),
    path('history/', ReportHistoryListView.as_view(), name='report_history'),
    # Report endpoints
    path('daily/', DailyReportView.as_view(), name='report_daily'),
    path('weekly/', WeeklyReportView.as_view(), name='report_weekly'),
    path('monthly/', MonthlyReportView.as_view(), name='report_monthly'),
    path('semester/', SemesterReportView.as_view(), name='report_semester'),
    path('department/', DepartmentReportView.as_view(), name='report_department'),
    path('faculty/', FacultyReportView.as_view(), name='report_faculty'),
    path('student/', StudentReportView.as_view(), name='report_student'),
    path('subject/', SubjectReportView.as_view(), name='report_subject'),
    
    # Analytics endpoints
    path('analytics/dashboard/', AnalyticsDashboardView.as_view(), name='analytics_dashboard'),
    path('analytics/trends/', AnalyticsTrendsView.as_view(), name='analytics_trends'),
    path('analytics/defaulters/', AnalyticsDefaultersView.as_view(), name='analytics_defaulters'),
    path('analytics/alerts/', AnalyticsAlertsView.as_view(), name='analytics_alerts'),
    path('analytics/department/', AnalyticsDepartmentView.as_view(), name='analytics_department'),
    path('analytics/subject/', AnalyticsSubjectView.as_view(), name='analytics_subject'),
    path('analytics/heatmap/', AnalyticsHeatmapView.as_view(), name='analytics_heatmap'),
    path('analytics/', AnalyticsOverviewView.as_view(), name='analytics_overview'),
    
    # Export endpoints
    path('export/csv/', ExportCSVView.as_view(), name='export_csv'),
    path('export/excel/', ExportExcelView.as_view(), name='export_excel'),
    path('export/pdf/', ExportPDFView.as_view(), name='export_pdf'),
    path('export/tasks/<str:task_id>/status/', ExportTaskStatusView.as_view(), name='export_task_status'),
    path('export/tasks/<str:task_id>/download/', ExportTaskDownloadView.as_view(), name='export_task_download'),
]
