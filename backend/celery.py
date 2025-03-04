from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    "check_driver_proximity_every_minute": {
        "task": "Taxi.tasks.check_driver_proximity",
        "schedule": crontab(minute="*/1"),  # Runs every 1 minute
        "args": (),
    },
}

# CELERY_BEAT_SCHEDULE = {
#     "check_license_expiry_daily": {
#         "task": "Taxi.tasks.check_license_expiry",
#         "schedule": crontab(hour=0, minute=0),
#     },
# }



CELERY_BEAT_SCHEDULE = {
    "check_license_expiry_daily": {
        "task": "Taxi.tasks.check_license_expiry",
        "schedule": crontab(hour=0, minute=0),
    },
}