import os
from celery import Celery
# from celery.schedules import crontab

# Set the default Django settings module for the 'celery' program
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'carpoolBackend.settings')

# Create Celery app
app = Celery('carpoolBackend')

# Load task modules from all registered Django app configs
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all installed apps
app.autodiscover_tasks()

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')


# from celery.schedules import crontab

# CELERY_BEAT_SCHEDULE = {
#     "check_driver_proximity_every_minute": {
#         "task": "Taxi.tasks.check_driver_proximity",
#         "schedule": crontab(minute="*/1"),  # Runs every 1 minute
#         "args": (),
#     },
# }

# # CELERY_BEAT_SCHEDULE = {
# #     "check_license_expiry_daily": {
# #         "task": "Taxi.tasks.check_license_expiry",
# #         "schedule": crontab(hour=0, minute=0),
# #     },
# # }



# CELERY_BEAT_SCHEDULE = {
#     "check_license_expiry_daily": {
#         "task": "Taxi.tasks.check_license_expiry",
#         "schedule": crontab(hour=0, minute=0),
#     },
# }

# app.conf.beat_schedule = {
#     "match-passengers-every-5-minutes": {
#         "task": "Taxi.tasks.match_passengers_to_rides",
#         "schedule": crontab(minute="*/5"),
#     },
# }