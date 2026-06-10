import logging

class BaseService:
    """
    Base Service class providing standard logger setups and transaction hooks.
    """
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__module__ + "." + self.__class__.__name__)
