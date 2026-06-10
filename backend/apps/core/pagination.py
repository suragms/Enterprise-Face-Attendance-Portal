from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    """
    Standard page-number pagination for heavy enterprise records collections.
    Caps results sets to 20 elements per page by default, permitting clients
    to override up to 100 elements.
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
