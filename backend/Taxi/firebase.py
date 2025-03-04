from pyfcm import FCMNotification
from django.conf import settings

push_service = FCMNotification(api_key=settings.FCM_SERVER_KEY)

def send_push_notification(user, message):
    """Send a push notification via Firebase to a user."""
    if user.fcm_token:
        push_service.notify_single_device(
            registration_id=user.fcm_token,
            message_title="Ride Update",
            message_body=message
        )
