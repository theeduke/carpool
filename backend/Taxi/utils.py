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


from .models import NTSAVerificationLog, CustomUser
from django.utils.timezone import now, timedelta

def verify_driving_license(request):
    """
    Function to validate Driving License using NTSA TIMS API.
    """
    NTSA_API_URL = "https://tims.ntsa.go.ke/api/validate_license"
    API_KEY = settings.NTSA_API_KEY  # Store API key in env variables

    user = request.user  # Get the authenticated user
    # if user.is_blocked:
    #     return {"error": "Your verification attempts are blocked. Contact admin."}
    
     # Check if the user is in cooldown mode
    if user.cooldown_until and user.cooldown_until > now():
        remaining_time = (user.cooldown_until - now()).total_seconds() // 60
        return {"error": f"Too many failed attempts. Try again in {remaining_time} minutes."}
    
    if not user.driving_license_number:
        return {"error": "No driving license number found for this user."}
    
     # Count failed attempts in the last hour
    one_hour_ago = now() - timedelta(hours=1)
    failed_attempts = NTSAVerificationLog.objects.filter(
        user=user, status="failed", timestamp__gte=one_hour_ago
    ).count()

    if failed_attempts >= 3:
        # Set cooldown for 3 hours
        user.cooldown_until = now() + timedelta(hours=3)
        user.save()
        return {"error": "Too many failed attempts. Try again after 3 hours."}
    
    #  # Check failed attempts in the last 24 hours
    # twenty_four_hours_ago = now() - timedelta(hours=24)
    # failed_attempts = NTSAVerificationLog.objects.filter(
    #     user=user, status="failed", timestamp__gte=twenty_four_hours_ago
    # ).count()

    # if failed_attempts >= 3:
    #     return {"error": "Too many failed attempts. Try again after 24 hours."}

    
    response = requests.post(
        NTSA_API_URL,
        json={"license_number": user.driving_license_number},
        headers={"Authorization": f"Bearer {API_KEY}"}
    )

    # if response.status_code == 200:
    #     data = response.json()
    #     return data.get("valid", False)  # True if license is valid
    # else:
    #     return False
    
     # Log the verification attempt
    log_entry = NTSAVerificationLog.objects.create(
        user=user,
        driving_license_number=user.driving_license_number,
        status="success" if response.status_code == 200 and response.json().get("valid", False) else "failed",
        response_data=response.json() if response.status_code == 200 else None,
    )

    return log_entry.status == "success"



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
from smtplib import SMTPException
import logging
logger = logging.getLogger(__name__)


def create_token(user, extra_payload):
    """Generate a JWT token with custom payload."""
    payload = {
        'id': str(user.id),
        'email': user.email,
        'timestamp': datetime.now().timestamp(),
        **extra_payload,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

def send_email(subject, message, recipient_email):
    """Send an email to the recipient."""
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [recipient_email])

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
            'is_active': user.is_active,  # Include user activation status
            'exp': (datetime.now() + timedelta(hours=24)).timestamp(),  # Token expires in 24 hours
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
        # 'domain': current_site.domain,
        # "http://{{ domain }}{% url 'activate' uidb64=uid token=token %}">
        # Email details
        verification_link = f"{settings.BACKEND_URL}/verify-email/?token={token}"
        subject = "Verify your email"
        message = f"Hi {user.first_name},\n\nClick the link to verify your email: {verification_link}"

        # Send email
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
        return True
    except SMTPException as e:
        logger.error(f"Failed to send email to {user.email}: {e}")
        return False