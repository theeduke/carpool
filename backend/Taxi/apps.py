from django.apps import AppConfig


class TaxiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'Taxi'
    
    def ready(self):
        import Taxi.signals
