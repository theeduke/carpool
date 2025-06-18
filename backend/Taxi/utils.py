import requests
from django.conf import settings

def verify_national_id(national_id):
    #cheks the Kenya National Population Registry.
    """
    Function to validate National ID using the eCitizen API.
    """
    ECITIZEN_API_URL = "https://ecitizen.go.ke/api/validate_id"
    API_KEY = settings.ECITIZEN_API_KEY  # Store API key in env variables

    response = requests.post(
        ECITIZEN_API_URL,
        json={"national_id": national_id},
        headers={"Authorization": f"Bearer {API_KEY}"}
    )

    if response.status_code == 200:
        data = response.json()
        return data.get("valid", False)  # True if ID is valid
    else:
        return False


# from .models import NTSAVerificationLog, CustomUser
from django.utils.timezone import now, timedelta





 #to send websocket messages
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from Taxi.firebase import send_push_notification # for firebase cloud messaging

def send_notification(id, message, carpoolride_id=None):
    """Send a real-time WebSocket notification to a specific user."""
    """
    Send a real-time WebSocket notification to a specific user.
    
    Args:
        id: The user ID.
        message (str): The notification message.
        carpoolride_id (str, optional): The ID of the ride associated with the notification.
    """
    channel_layer = get_channel_layer()
    group_name = f"user_{id}"

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "send_notification",
            "message": message,
            "carpoolride_id": carpoolride_id,
        },
    )

def notify_user(user, message,  carpoolride_id=None):
    """Send a notification via WebSockets and Firebase."""
    """Send a notification to a user via WebSockets and Firebase.
    
    Args:
        user: The CustomUser instance to notify.
        message (str): The message content to send.
        ride_id (str, optional): The ID of the ride associated with the notification.
    """
    print(f"this is the what the nofiy users gets {carpoolride_id}")
    # send_notification(user.id, message) 
    send_notification(user.id, message, carpoolride_id=carpoolride_id)  # WebSocket
    # send_push_notification(user, message)  # Firebase
    # Firebase push notification
    if hasattr(user, 'fcm_token') and user.fcm_token:
        send_push_notification(
            token=user.fcm_token,
            title="Ride Update",  # Fixed title for notifications
            body=message         # Use message as the body
        )
    else:
        print(f"No FCM token for user {user.id}")
    
    
    
        #mpesa
import base64
import requests
from datetime import datetime
from django.conf import settings

def get_mpesa_access_token():
    url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    auth = base64.b64encode(f"{settings.MPESA_CONSUMER_KEY}:{settings.MPESA_CONSUMER_SECRET}".encode()).decode()
    headers = {"Authorization": f"Basic {auth}"}
    response = requests.get(url, headers=headers)
    return response.json()["access_token"]

def generate_stk_password():
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    data = f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}"
    return base64.b64encode(data.encode()).decode()

def generate_timestamp():
    return datetime.now().strftime("%Y%m%d%H%M%S")


######user email and tokens
import jwt
from django.core.mail import send_mail
from django.conf import settings
from datetime import datetime, timedelta
from django.utils import timezone
from smtplib import SMTPException
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives
import logging
logger = logging.getLogger(__name__)


def send_email(subject, message, to_email, html_message=None):
    """
    Send an email with both plain text and HTML versions.
    
    Args:
        subject (str): Email subject
        message (str): Plain text message body
        to_email (str or list): Recipient email address(es)
        html_message (str, optional): HTML message body. If None, rendered from template.
    """
    try:
        # Prepare context for templates
        context = {
            'subject': subject,
            'user_name': to_email if isinstance(to_email, str) else to_email[0].split('@')[0],
            'message': message,
            'year': timezone.now().year,
        }

        # Render templates
        text_content = render_to_string('emails/base_email.txt', context)
        html_content = html_message or render_to_string('emails/base_email.html', context)

        # Create email
        email = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to_email] if isinstance(to_email, str) else to_email,
        )
        email.attach_alternative(html_content, "text/html")

        # Send email
        email.send()
        logger.info(f"Email sent to {to_email} with subject: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False
    
#verification mail
def send_verification_email(user):
    try:
        if user.is_active:
            logger.warning(f"User {user.email} is already active. Verification email not sent.")
            return False
        
        # JWT payload with expiration
        payload = {
            'id': str(user.id),
            'email': user.email,
            'verification': True,
            'is_active': user.is_active,
            'exp': (timezone.now() + timedelta(hours=24)).timestamp(),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
        verification_link = f"{settings.FRONTEND_URL}/verify-email/?token={token}"

        # Prepare email content
        subject = "Verify Your Email Address"
        message = (
            f"Hi {user.first_name},\n\n"
            f"Please click the link below to verify your email address:\n"
            f"<a href='{verification_link}' style='color: #4CAF50; text-decoration: none;'>Verify Email</a>\n\n"
            f"This link will expire in 24 hours."
        )

        # Render templates
        context = {
            'subject': subject,
            'user_name': user.first_name,
            'message': message,
            'year': timezone.now().year,
        }
        text_content = render_to_string('emails/base_email.txt', context)
        html_content = render_to_string('emails/base_email.html', context)

        # Send email
        email = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            # from_email=settings.DEFAULT_FROM_EMAIL,
            from_email=f"DukeRides <{settings.DEFAULT_FROM_EMAIL}>", 
            to=[user.email],
        )
        email.attach_alternative(html_content, "text/html")
        email.send()
        logger.info(f"Verification email sent to {user.email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send verification email to {user.email}: {str(e)}")
        return False

def create_token(user, extra_payload):
    """Generate a JWT token with custom payload."""
    payload = {
        'id': str(user.id),
        'email': user.email,
        'timestamp': datetime.now().timestamp(),
        **extra_payload,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

# def send_email(subject, message, recipient_email):
#     """Send an email to the recipient."""
#     send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [recipient_email])

# def send_verification_email(user):
#     try:
#         if user.is_active:
#             logger.warning(f"User {user.email} is already active. Verification email not sent.")
#             return False
        
#         # JWT payload with expiration
#         payload = {
#             'id': str(user.id),
#             'email': user.email,
#             'verification': True,
#             'is_active': user.is_active,  # Include user activation status
#             'exp': (datetime.now() + timedelta(hours=24)).timestamp(),  # Token expires in 24 hours
#         }
#         token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
#         # 'domain': current_site.domain,
#         # "http://{{ domain }}{% url 'activate' uidb64=uid token=token %}">
#         # Email details
#         # verification_link = f"{settings.DEVBACKEND_URL}/verify-email/?token={token}"
#         verification_link = f"{settings.FRONTEND_URL}/verify-email/?token={token}"
#         subject = "Verify your email"
#         message = f"Hi {user.first_name},\n\nClick the link to verify your email: {verification_link}"

#         # Send email
#         send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
#         return True
#     except SMTPException as e:
#         logger.error(f"Failed to send email to {user.email}: {e}")
#         return False