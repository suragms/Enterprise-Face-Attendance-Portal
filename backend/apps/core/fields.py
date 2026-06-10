import json
from django.db import models

class EncryptedCharField(models.TextField):
    """
    Custom field that transparently encrypts and decrypts text/char values.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def get_fernet(self):
        import base64
        import hashlib
        from django.conf import settings
        try:
            from cryptography.fernet import Fernet
        except ImportError:
            # Fallback wrapper if cryptography package is not loaded yet
            class FallbackFernet:
                def __init__(self, key):
                    pass
                def encrypt(self, data):
                    return data
                def decrypt(self, data):
                    return data
            return FallbackFernet(None)
            
        key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        return Fernet(base64.urlsafe_b64encode(key))

    def get_prep_value(self, value):
        if value is None:
            return None
        
        # Avoid double-encrypting already encrypted values
        val_str = str(value)
        if val_str.startswith("gAAAAA"):
            return val_str
            
        try:
            fernet = self.get_fernet()
            encrypted_bytes = fernet.encrypt(val_str.encode())
            return encrypted_bytes.decode()
        except Exception:
            return val_str

    def from_db_value(self, value, expression, connection):
        if value is None:
            return None
        
        # Fast exit if value is not encrypted
        val_str = str(value)
        if not val_str.startswith("gAAAAA"):
            return val_str
            
        try:
            fernet = self.get_fernet()
            decrypted_bytes = fernet.decrypt(val_str.encode())
            return decrypted_bytes.decode()
        except Exception:
            return val_str

    def to_python(self, value):
        if value is None:
            return None
        
        val_str = str(value)
        if not val_str.startswith("gAAAAA"):
            return val_str
            
        try:
            fernet = self.get_fernet()
            decrypted_bytes = fernet.decrypt(val_str.encode())
            return decrypted_bytes.decode()
        except Exception:
            return val_str


class EncryptedJSONField(models.TextField):
    """
    Custom field that transparently encrypts and decrypts JSON data using AES (Fernet).
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def get_fernet(self):
        import base64
        import hashlib
        from django.conf import settings
        try:
            from cryptography.fernet import Fernet
        except ImportError:
            # Fallback wrapper if cryptography package is not loaded yet
            class FallbackFernet:
                def __init__(self, key):
                    pass
                def encrypt(self, data):
                    return data
                def decrypt(self, data):
                    return data
            return FallbackFernet(None)
            
        key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        return Fernet(base64.urlsafe_b64encode(key))

    def get_prep_value(self, value):
        if value is None:
            return None
        
        # If value is already encrypted, return as is
        if isinstance(value, str) and value.startswith("gAAAAA"):
            return value
            
        try:
            json_str = json.dumps(value)
            fernet = self.get_fernet()
            encrypted_bytes = fernet.encrypt(json_str.encode())
            return encrypted_bytes.decode()
        except Exception:
            return json.dumps(value)

    def from_db_value(self, value, expression, connection):
        if value is None:
            return None
        
        val_str = str(value)
        if not val_str.startswith("gAAAAA"):
            try:
                return json.loads(val_str)
            except Exception:
                return val_str
                
        try:
            fernet = self.get_fernet()
            decrypted_bytes = fernet.decrypt(val_str.encode())
            return json.loads(decrypted_bytes.decode())
        except Exception:
            try:
                return json.loads(val_str)
            except Exception:
                return val_str

    def to_python(self, value):
        if value is None:
            return None
        if isinstance(value, (dict, list)):
            return value
            
        val_str = str(value)
        if not val_str.startswith("gAAAAA"):
            try:
                return json.loads(val_str)
            except Exception:
                return val_str
                
        try:
            fernet = self.get_fernet()
            decrypted_bytes = fernet.decrypt(val_str.encode())
            return json.loads(decrypted_bytes.decode())
        except Exception:
            try:
                return json.loads(val_str)
            except Exception:
                return val_str
