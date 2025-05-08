import firebase_admin
from firebase_admin import credentials, messaging
from django.conf import settings

# Initialize Firebase app
if not firebase_admin._apps:
    cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS)
    firebase_admin.initialize_app(cred)

def send_push_notification(token, title, body):
    """
    Send a Firebase push notification to a specific device.
    
    Args:
        token (str): The FCM token for the user's device.
        title (str): The title of the notification.
        body (str): The body content of the notification.
    
    Returns:
        str: Response from Firebase or None if failed.
    """
    if not token:
        print("No FCM token provided")
        return None

    message = messaging.Message(
        notification=messaging.Notification(title=title, body=body),
        token=token,
    )
    try:
        response = messaging.send(message)
        print(f"Successfully sent notification: {response}")
        return response
    except Exception as e:
        print(f"Error sending notification: {e}")
        return None



# from pyfcm import FCMNotification
# from django.conf import settings

# push_service = FCMNotification(api_key=settings.FCM_SERVER_KEY)

# def send_push_notification(user, message):
#     """Send a push notification via Firebase to a user."""
#     if user.fcm_token:
#         push_service.notify_single_device(
#             registration_id=user.fcm_token,
#             message_title="Ride Update",
#             message_body=message
#         )
